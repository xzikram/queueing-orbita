const axios = require('axios');
const io = require('socket.io-client');
const { ipcRenderer } = require('electron');

const DEFAULT_SERVER_URL = 'http://192.168.40.131:3001';

function cleanServerUrl(inputUrl) {
  if (!inputUrl) return DEFAULT_SERVER_URL;
  let url = inputUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/api$/, '');
  return url;
}

function getInitialServerUrl() {
  let saved = localStorage.getItem('orbita_server_url');
  if (!saved || saved.includes('localhost') || saved.includes('127.0.0.1')) {
    saved = DEFAULT_SERVER_URL;
    localStorage.setItem('orbita_server_url', DEFAULT_SERVER_URL);
  }
  return cleanServerUrl(saved);
}

let state = {
  token: localStorage.getItem('orbita_token') || null,
  user: JSON.parse(localStorage.getItem('orbita_user') || 'null'),
  serverUrl: getInitialServerUrl(),
  socket: null,
  counters: [],
  floors: [],
  rooms: [],
  selectedFloor: localStorage.getItem('orbita_selected_floor') || null,
  selectedRoom: localStorage.getItem('orbita_selected_room') || null,
  selectedDoctor: localStorage.getItem('orbita_selected_doctor') || null,
  counterStatus: 'STANDBY',
  doctors: [],
  schedules: [],
  selectedCounter: localStorage.getItem('orbita_selected_counter') || null,
  activeTab: 'ADMISSION', // 'ADMISSION' | 'ASSESSMENT' | 'DOCTOR' | 'BDR' | 'CDC' | 'CASHIER'
  unitWaitingList: [],
  activeCall: null,
  isManualMode: false,
  clockTimer: null,

  targetCancelTicket: null,
  lastActiveCallId: null,
};

// --- GLOBAL STATE SWITCHING FUNCTIONS (DEFINED EARLY) ---
window.onUnitSelectChange = function(selectEl) {
  const newUnit = selectEl ? selectEl.value : (inputs.unitSelect ? inputs.unitSelect.value : 'ADMISSION');
  console.log('[Orbita] onUnitSelectChange -> newUnit:', newUnit);
  state.activeTab = newUnit;
  state.isManualMode = false;
  state.activeCall = null;
  state.unitWaitingList = [];
  if (typeof updateCounterUI === 'function') updateCounterUI();
  refreshQueues();
};

window.toggleManualTicketMode = function() {
  console.log('[Orbita] toggleManualTicketMode triggered! Setting isManualMode = true');
  state.isManualMode = true;
  renderCurrentState();
};

window.cancelManualTicketMode = function() {
  console.log('[Orbita] cancelManualTicketMode triggered! Setting isManualMode = false');
  state.isManualMode = false;
  refreshQueues();
};

window.createTicket = async function(unit, patientType) {
  console.log('[Orbita] createTicket called -> unit:', unit, 'patientType:', patientType);
  try {
    let res;
    if (unit === 'CASHIER') {
      res = await axios.post('/queue-tickets/cashier', { patientType });
    } else {
      res = await axios.post('/queue-tickets/admission', { patientType });
    }
    const ticketNo = res.data?.ticketNo || 'Baru';
    showToast(`✅ Tiket ${ticketNo} berhasil dibuat!`, false);
    state.isManualMode = false;
    await refreshQueues();
    ipcRenderer.send('show-window');
  } catch (err) {
    alert("Gagal mengambil antrean: " + (err.response?.data?.message || err.message));
  }
};

const UNIT_CONFIG = {
  ADMISSION: {
    label: 'Admisi',
    icon: '🏢',
    queueEndpoint: '/admission/queue',
    callEndpoint: (id) => `/admission/${id}/call`,
    finishEndpoint: (id) => `/admission/${id}/finish`,
    holdEndpoint: (id) => `/admission/${id}/hold`,
    cancelEndpoint: (id) => `/admission/${id}/cancel`,
    hasDoctorForm: true,
    hasDestSelect: true,
    destOptions: [
      { value: 'ASSESSMENT', label: '📋 Pengkajian' },
      { value: 'DOCTOR', label: '🩺 Dokter (Poli)' },
      { value: 'BDR', label: '🩸 BDR' },
      { value: 'CDC', label: '🔬 CDC' },
      { value: 'CASHIER', label: '💳 Kasir' },
    ]
  },
  ASSESSMENT: {
    label: 'Pengkajian',
    icon: '📋',
    queueEndpoint: '/assessment/queue',
    callEndpoint: (id) => `/assessment/${id}/start`,
    finishEndpoint: (id) => `/assessment/${id}/finish`,
    holdEndpoint: (id) => `/assessment/${id}/hold`,
    cancelEndpoint: (id) => `/assessment/${id}/cancel`,
    hasDoctorForm: false,
    hasDestSelect: true,
    destOptions: [
      { value: 'BDR', label: '🩸 BDR' },
      { value: 'DOCTOR', label: '🩺 Dokter (Poli)' },
      { value: 'CDC', label: '🔬 CDC' },
    ]
  },
  BDR: {
    label: 'BDR',
    icon: '🩸',
    queueEndpoint: '/bdr/queue',
    callEndpoint: (id) => `/bdr/${id}/call`,
    finishEndpoint: (id) => `/bdr/${id}/finish`,
    holdEndpoint: (id) => `/bdr/${id}/hold`,
    cancelEndpoint: (id) => `/bdr/${id}/cancel`,
    hasDoctorForm: false,
    hasDestSelect: true,
    destOptions: [
      { value: 'DOCTOR', label: '🩺 Dokter (Poli)' },
      { value: 'CDC', label: '🔬 CDC' },
    ]
  },
  DOCTOR: {
    label: 'Dokter (Poli)',
    icon: '🩺',
    queueEndpoint: '/doctor-queue/queue',
    callEndpoint: (id) => `/doctor-queue/${id}/call`,
    finishEndpoint: (id) => `/doctor-queue/${id}/finish`,
    holdEndpoint: (id) => `/doctor-queue/${id}/hold`,
    cancelEndpoint: (id) => `/doctor-queue/${id}/cancel`,
    hasDoctorForm: false,
    hasDestSelect: true,
    destOptions: [
      { value: 'FINISHED', label: '✅ Selesai (Pasien Pulang)' },
      { value: 'CDC', label: '🔬 CDC (Penunjang)' },
    ]
  },
  CDC: {
    label: 'CDC',
    icon: '🔬',
    queueEndpoint: '/cdc/queue',
    callEndpoint: (id) => `/cdc/${id}/start`,
    finishEndpoint: (id) => `/cdc/${id}/finish`,
    holdEndpoint: (id) => `/cdc/${id}/hold`,
    cancelEndpoint: (id) => `/cdc/${id}/cancel`,
    hasDoctorForm: false,
    hasDestSelect: true,
    destOptions: [
      { value: 'DOCTOR', label: '🩺 Dokter (Poli)' },
      { value: 'FINISHED', label: '✅ Selesai (Pasien Pulang)' },
    ]
  },
  CASHIER: {
    label: 'Kasir',
    icon: '💳',
    queueEndpoint: '/cashier/queue',
    callEndpoint: (id) => `/cashier/${id}/call`,
    finishEndpoint: (id) => `/cashier/${id}/finish`,
    holdEndpoint: (id) => `/cashier/${id}/hold`,
    cancelEndpoint: (id) => `/cashier/${id}/cancel`,
    hasDoctorForm: false,
    hasDestSelect: false,
    destOptions: []
  }
};

// --- DOM ELEMENTS ---
const screens = {
  login: document.getElementById('loginScreen'),
  caller: document.getElementById('callerScreen')
};

const inputs = {
  serverUrl: document.getElementById('serverUrl'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  unitSelect: document.getElementById('unitSelect'),
  counterButtonList: document.getElementById('counterButtonList'),
  doctorInput: document.getElementById('doctorInput'),
  doctorTicketNoInput: document.getElementById('doctorTicketNoInput'),
  nextUnitSelect: document.getElementById('nextUnitSelect'),
  cancelReasonInput: document.getElementById('cancelReasonInput'),
};

const texts = {
  loginError: document.getElementById('loginError'),
  userName: document.getElementById('userName'),
  currentCounterName: document.getElementById('currentCounterName'),
  ticketPrefix: document.getElementById('ticketPrefix'),
  ticketNum: document.getElementById('ticketNum'),
  activePatientType: document.getElementById('activePatientType'),
  activeTimerClock: document.getElementById('activeTimerClock'),
  activeStatusLabel: document.getElementById('activeStatusLabel'),
};

const buttons = {
  login: document.getElementById('loginBtn'),
  logout: document.getElementById('logoutBtn'),
  toggleCounterStatus: document.getElementById('toggleCounterStatusBtn'),
  changeCounter: document.getElementById('changeCounterBtn'),
  closeCounterModal: document.getElementById('closeCounterModalBtn'),
  minBtn: document.getElementById('minBtn'),
  finishBtn: document.getElementById('finishBtn'),
  startBtn: document.getElementById('startBtn'),
  recallBtn: document.getElementById('recallBtn'),
  holdBtn: document.getElementById('holdBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  closeCancelModal: document.getElementById('closeCancelModalBtn'),
  refreshHeaderBtn: document.getElementById('refreshHeaderBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  refreshBtn2: document.getElementById('refreshBtn2'),
  openNewTicketBtn: document.getElementById('openNewTicketBtn'),
  closeFastFinishModal: document.getElementById('closeFastFinishModalBtn'),
  confirmFastFinish: document.getElementById('confirmFastFinishBtn'),
  cancelFastFinish: document.getElementById('cancelFastFinishBtn'),
};

const containers = {
  activeStateContainer: document.getElementById('activeStateContainer'),
  idleStateContainer: document.getElementById('idleStateContainer'),
  activeControlsGrid: document.getElementById('activeControlsGrid'),
  idleControlsBox: document.getElementById('idleControlsBox'),
  manualControlsBox: document.getElementById('manualControlsBox'),
  counterModal: document.getElementById('counterModal'),
  cancelModal: document.getElementById('cancelModal'),
  fastFinishModal: document.getElementById('fastFinishModal'),
  categoryGrid: document.getElementById('categoryGrid'),
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  state.serverUrl = cleanServerUrl(state.serverUrl);
  inputs.serverUrl.value = state.serverUrl;
  
  if (state.token && state.user) {
    setupAxios();
    initCallerScreen();
  } else {
    showScreen('login');
  }
});

// --- WINDOW CONTROLS ---
buttons.minBtn.addEventListener('click', () => ipcRenderer.send('minimize-window'));

// --- UNIT SELECT CHANGE HANDLER ---
if (inputs.unitSelect) {
  inputs.unitSelect.addEventListener('change', (e) => {
    const newUnit = e.target.value;
    console.log('[Orbita] Unit changed to:', newUnit);
    state.activeTab = newUnit;
    state.isManualMode = false;
    state.activeCall = null;
    state.unitWaitingList = [];

    if (buttons.openNewTicketBtn) {
      buttons.openNewTicketBtn.style.display = 'flex';
    }

    refreshQueues();
  });
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

let interceptorAdded = false;
function setupAxios() {
  const url = cleanServerUrl(state.serverUrl);
  state.serverUrl = url;
  axios.defaults.baseURL = url + '/api';
  if (state.token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
  }

  if (!interceptorAdded) {
    interceptorAdded = true;
    axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401 && state.token) {
          console.warn('[Orbita] Session expired or invalid token (401). Redirecting to login screen.');
          localStorage.removeItem('orbita_token');
          localStorage.removeItem('orbita_user');
          state.token = null;
          state.user = null;
          if (state.socket) {
            state.socket.disconnect();
            state.socket = null;
          }
          showScreen('login');
          if (texts.loginError) {
            texts.loginError.innerText = 'Sesi telah berakhir, silakan login kembali.';
          }
        }
        return Promise.reject(error);
      }
    );
  }
}

// --- LOGIN & LOGOUT ---
window.handleLogin = async function() {
  console.log('[Orbita] window.handleLogin triggered!');
  const serverUrlEl = document.getElementById('serverUrl');
  const emailEl = document.getElementById('email');
  const passwordEl = document.getElementById('password');
  const loginBtnEl = document.getElementById('loginBtn');
  const loginErrorEl = document.getElementById('loginError');

  const rawUrl = serverUrlEl ? serverUrlEl.value : '';
  const url = cleanServerUrl(rawUrl);
  const email = emailEl ? emailEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value : '';

  if (serverUrlEl) serverUrlEl.value = url;

  if (!email) {
    if (loginErrorEl) loginErrorEl.innerText = "❌ Silakan isi Email atau NIK Petugas terlebih dahulu.";
    if (emailEl) emailEl.focus();
    return;
  }

  if (!password) {
    if (loginErrorEl) loginErrorEl.innerText = "❌ Silakan isi Password terlebih dahulu.";
    if (passwordEl) passwordEl.focus();
    return;
  }

  if (loginBtnEl) loginBtnEl.disabled = true;
  if (loginErrorEl) loginErrorEl.innerText = "⏳ Menghubungkan ke server " + url + "...";

  try {
    const loginEndpoint = `${url}/api/auth/login`;
    console.log('[Orbita] Posting login request to:', loginEndpoint);

    const response = await fetch(loginEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = Array.isArray(data.message)
        ? data.message.join(', ')
        : (data.message || `HTTP ${response.status}`);
      throw new Error(msg);
    }

    if (!data.access_token) {
      throw new Error("Respon server tidak memiliki token akses valid.");
    }

    state.serverUrl = url;
    state.token = data.access_token;
    state.user = data.user || { name: 'Administrator' };

    localStorage.setItem('orbita_server_url', url);
    localStorage.setItem('orbita_token', state.token);
    localStorage.setItem('orbita_user', JSON.stringify(state.user));

    setupAxios();
    if (loginErrorEl) loginErrorEl.innerText = "";
    await initCallerScreen();

  } catch (err) {
    console.error('[Orbita] Login error:', err);
    if (loginErrorEl) {
      loginErrorEl.innerText = "❌ Login gagal: " + (err.message || "Gagal terhubung ke server");
    }
  } finally {
    if (loginBtnEl) loginBtnEl.disabled = false;
  }
};

const loginBtnEl = document.getElementById('loginBtn');
if (loginBtnEl) {
  loginBtnEl.addEventListener('click', (e) => {
    e.preventDefault();
    window.handleLogin();
  });
}

const loginFormEl = document.getElementById('loginForm');
if (loginFormEl) {
  loginFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    window.handleLogin();
  });
}

const passwordInputEl = document.getElementById('password');
if (passwordInputEl) {
  passwordInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.handleLogin();
    }
  });
}

const emailInputEl = document.getElementById('email');
if (emailInputEl) {
  emailInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.handleLogin();
    }
  });
}

buttons.logout.addEventListener('click', () => {
  localStorage.removeItem('orbita_token');
  localStorage.removeItem('orbita_user');
  state.token = null;
  state.user = null;
  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }
  showScreen('login');
});

function applyRoleUnitFiltering() {
  const userRole = (state.user?.role || 'ADMIN').toUpperCase();
  console.log('[Orbita] applyRoleUnitFiltering -> logged-in userRole:', userRole);

  const roleAllowedUnitsMap = {
    ADMIN: ['ADMISSION', 'ASSESSMENT', 'DOCTOR', 'BDR', 'CDC', 'CASHIER', 'PHARMACY', 'OPTIC'],
    MANAGEMENT: ['ADMISSION', 'ASSESSMENT', 'DOCTOR', 'BDR', 'CDC', 'CASHIER', 'PHARMACY', 'OPTIC'],
    ADMISSION: ['ADMISSION', 'CASHIER'],
    KEPALA_ADMISI: ['ADMISSION', 'CASHIER'],
    ASSESSMENT: ['ASSESSMENT', 'BDR'],
    BDR: ['BDR', 'ASSESSMENT'],
    CDC: ['CDC', 'DOCTOR'],
    DOCTOR: ['DOCTOR'],
    CASHIER: ['CASHIER'],
    PHARMACY: ['PHARMACY'],
    OPTIC: ['OPTIC'],
    QUEUE_OFFICER: ['ADMISSION', 'ASSESSMENT', 'DOCTOR', 'BDR', 'CDC', 'CASHIER']
  };

  let allowedUnits = roleAllowedUnitsMap[userRole] || roleAllowedUnitsMap.ADMIN;

  // Fallback to exe URL query parameter if specified and user is ADMIN
  if (userRole === 'ADMIN') {
    const urlParams = new URLSearchParams(window.location.search);
    const exeRole = urlParams.get('role');
    if (exeRole === 'ADMISI_KASIR') allowedUnits = ['ADMISSION', 'CASHIER'];
    else if (exeRole === 'PENGKAJIAN_CDC_DOKTER') allowedUnits = ['ASSESSMENT', 'CDC', 'DOCTOR'];
    else if (exeRole === 'BDR') allowedUnits = ['BDR'];
  }

  const select = inputs.unitSelect;
  if (!select) return;

  const unitMap = {
    ADMISSION: '🏢 Admisi',
    ASSESSMENT: '📋 Pengkajian',
    DOCTOR: '🩺 Dokter (Poli)',
    BDR: '🩸 BDR',
    CDC: '🔬 CDC',
    CASHIER: '💳 Kasir',
    PHARMACY: '💊 Farmasi',
    OPTIC: '👓 Optik'
  };

  select.innerHTML = '';
  allowedUnits.forEach(uKey => {
    const opt = document.createElement('option');
    opt.value = uKey;
    opt.innerText = unitMap[uKey] || uKey;
    select.appendChild(opt);
  });

  state.activeTab = select.value || allowedUnits[0];
}

async function loadFloors() {
  try {
    const res = await axios.get('/floors');
    const allFloors = Array.isArray(res.data) ? res.data : [];
    // Filter out Lantai 1 for Pengkajian & BDR matching Web Dashboard logic
    state.floors = allFloors.filter(f => f.floorNumber !== 1 && !f.name.includes('Lantai 1') && f.name !== 'Lantai 1');
    if (state.floors.length > 0 && (!state.selectedFloor || !state.floors.some(f => f.id === state.selectedFloor))) {
      state.selectedFloor = state.floors[0].id;
    }
  } catch (err) {
    console.error('loadFloors ERROR:', err);
  }
}

async function loadRooms() {
  try {
    const res = await axios.get('/rooms');
    const all = Array.isArray(res.data) ? res.data : [];
    const doctorRooms = all.filter(r => ['DOCTOR', 'DOCTOR_CHILD'].includes(r.roomType));
    
    state.rooms = [
      { id: 'ALL', name: '✨ Semua Poli / Ruangan', code: 'ALL', roomType: 'DOCTOR' },
      ...doctorRooms
    ];

    if (!state.selectedRoom || !state.rooms.some(r => r.id === state.selectedRoom)) {
      state.selectedRoom = 'ALL';
    }
  } catch (err) {
    console.error('loadRooms ERROR:', err);
  }
}

// --- CALLER SCREEN ENGINE ---
async function initCallerScreen() {
  showScreen('caller');
  texts.userName.innerText = state.user.name || 'Administrator';
  
  applyRoleUnitFiltering();
  
  if (inputs.unitSelect && inputs.unitSelect.value) {
    state.activeTab = inputs.unitSelect.value;
  }

  startLiveClock();
  await loadFloors();
  await loadRooms();
  await loadCounters();
  await loadDoctors();
  updateCounterUI();
  await refreshQueues();
  initSocket();
}

function startLiveClock() {
  if (state.clockTimer) clearInterval(state.clockTimer);
  const updateClock = () => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    texts.activeTimerClock.innerText = `⏱️ ${hrs}:${mins}`;
  };
  updateClock();
  state.clockTimer = setInterval(updateClock, 10000);
}

// --- COUNTER MANAGEMENT ---
async function loadCounters() {
  const list = inputs.counterButtonList;
  try {
    console.log('loadCounters: fetching from', axios.defaults.baseURL + '/counters');
    list.innerHTML = '<div style="text-align:center;padding:12px;color:#64748b;font-weight:600;">⏳ Memuat loket...</div>';
    
    const res = await axios.get('/counters');
    console.log('loadCounters: response', JSON.stringify(res.data).substring(0, 200));
    state.counters = Array.isArray(res.data) ? res.data : [];
    
    renderCounterButtons();

    if (state.selectedCounter && state.counters.some(c => c.id === state.selectedCounter)) {
      // keep existing selection
    } else if (state.counters.length > 0) {
      state.selectedCounter = state.counters[0].id;
    }
    updateCounterUI();
    highlightSelectedCounterBtn();
    if (state.selectedCounter) await fetchCounterStatus(state.selectedCounter);
  } catch (err) {
    console.error('loadCounters ERROR:', err.message, err.response?.status, err.response?.data);
    list.innerHTML = `<div style="text-align:center;padding:16px;color:#ef4444;font-weight:700;font-size:12px;">
      ❌ Gagal memuat counter<br>
      <span style="font-size:10px;color:#94a3b8;font-weight:400;">${err.message}</span><br>
      <button onclick="loadCounters()" style="margin-top:8px;padding:6px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;font-size:11px;">🔄 Coba Lagi</button>
    </div>`;
  }
}

function updateCounterModalTitle() {
  const modalHeader = document.querySelector('#counterModal h3');
  if (!modalHeader) return;

  if (state.activeTab === 'ASSESSMENT') {
    modalHeader.innerText = '🏢 Pilih Lantai Pengkajian';
  } else if (state.activeTab === 'BDR') {
    modalHeader.innerText = '🩸 Pilih Lantai BDR';
  } else if (state.activeTab === 'DOCTOR') {
    modalHeader.innerText = '🩺 Pilih Ruangan / Poli Dokter';
  } else if (state.activeTab === 'CDC') {
    modalHeader.innerText = '🔬 Pilih Ruang CDC';
  } else {
    modalHeader.innerText = '📍 Pilih Loket Jaga';
  }
}

function renderCounterButtons() {
  const list = inputs.counterButtonList;
  if (!list) return;
  list.innerHTML = '';

  if (state.activeTab === 'ASSESSMENT' || state.activeTab === 'BDR') {
    if (state.floors.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:16px;color:#94a3b8;font-weight:600;">Tidak ada lantai di database</div>';
      return;
    }
    state.floors.forEach(f => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'counter-btn';
      if (f.id === state.selectedFloor) btn.classList.add('selected');
      btn.innerHTML = `<span class="counter-icon">🏢</span> ${f.name}`;
      btn.addEventListener('click', () => {
        state.selectedFloor = f.id;
        localStorage.setItem('orbita_selected_floor', f.id);
        updateCounterUI();
        highlightSelectedCounterBtn();
        containers.counterModal.classList.remove('active');
        refreshQueues();
      });
      list.appendChild(btn);
    });
  } else if (state.activeTab === 'DOCTOR') {
    if (state.rooms.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:16px;color:#94a3b8;font-weight:600;">Tidak ada ruangan poli di database</div>';
      return;
    }
    state.rooms.forEach(r => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'counter-btn';
      if (r.id === state.selectedRoom) btn.classList.add('selected');
      btn.innerHTML = `<span class="counter-icon">🩺</span> ${r.name}`;
      btn.addEventListener('click', () => {
        state.selectedRoom = r.id;
        localStorage.setItem('orbita_selected_room', r.id);
        updateCounterUI();
        highlightSelectedCounterBtn();
        containers.counterModal.classList.remove('active');
        refreshQueues();
      });
      list.appendChild(btn);
    });
  } else if (state.activeTab === 'CDC') {
    const listFloors = state.floors.length > 0 ? state.floors : [{ id: 'cdc1', name: 'CDC Lantai 6' }];
    listFloors.forEach(f => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'counter-btn';
      if (f.id === state.selectedFloor) btn.classList.add('selected');
      btn.innerHTML = `<span class="counter-icon">🔬</span> CDC (${f.name})`;
      btn.addEventListener('click', () => {
        state.selectedFloor = f.id;
        localStorage.setItem('orbita_selected_floor', f.id);
        updateCounterUI();
        highlightSelectedCounterBtn();
        containers.counterModal.classList.remove('active');
        refreshQueues();
      });
      list.appendChild(btn);
    });
  } else {
    // ADMISSION or CASHIER
    if (state.counters.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:16px;color:#94a3b8;font-weight:600;">Tidak ada counter tersedia</div>';
      return;
    }
    state.counters.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'counter-btn';
      if (c.id === state.selectedCounter) btn.classList.add('selected');
      btn.innerHTML = `<span class="counter-icon">📍</span> ${c.name}`;
      btn.addEventListener('click', () => selectCounter(c.id));
      list.appendChild(btn);
    });
  }
}

function selectCounter(counterId) {
  state.selectedCounter = counterId;
  localStorage.setItem('orbita_selected_counter', counterId);
  updateCounterUI();
  highlightSelectedCounterBtn();
  fetchCounterStatus(counterId);
  containers.counterModal.classList.remove('active');
  refreshQueues();
}

function highlightSelectedCounterBtn() {
  const btns = inputs.counterButtonList.querySelectorAll('.counter-btn');
  btns.forEach(b => {
    if (state.activeTab === 'ASSESSMENT' || state.activeTab === 'BDR' || state.activeTab === 'CDC') {
      b.classList.toggle('selected', b.innerHTML.includes(state.selectedFloor));
    } else if (state.activeTab === 'DOCTOR') {
      b.classList.toggle('selected', b.innerHTML.includes(state.selectedRoom));
    } else {
      b.classList.toggle('selected', b.dataset.counterId === state.selectedCounter);
    }
  });
}

async function fetchCounterStatus(counterId) {
  try {
    const res = await axios.get(`/counters/${counterId}`);
    state.counterStatus = res.data.status || 'STANDBY';
    updateCounterStatusUI();
  } catch (err) {}
}

function updateCounterUI() {
  if (state.activeTab === 'ASSESSMENT' || state.activeTab === 'BDR') {
    const floor = state.floors.find(f => f.id === state.selectedFloor) || state.floors[0];
    texts.currentCounterName.innerText = floor ? floor.name : 'Lantai 5';
    if (floor && state.selectedFloor !== floor.id) {
      state.selectedFloor = floor.id;
    }
  } else if (state.activeTab === 'DOCTOR') {
    const room = state.rooms.find(r => r.id === state.selectedRoom) || state.rooms[0];
    texts.currentCounterName.innerText = room ? room.name : 'Poli 5A';
    if (room && state.selectedRoom !== room.id) {
      state.selectedRoom = room.id;
    }
  } else if (state.activeTab === 'CDC') {
    const floor = state.floors.find(f => f.id === state.selectedFloor) || state.floors[0];
    texts.currentCounterName.innerText = floor ? `CDC (${floor.name})` : 'CDC Lantai 6';
  } else {
    // ADMISSION or CASHIER
    const current = state.counters.find(c => c.id === state.selectedCounter) || state.counters[0];
    texts.currentCounterName.innerText = current ? current.name : 'Counter 1';
    if (current && state.selectedCounter !== current.id) state.selectedCounter = current.id;
  }
}

function updateCounterStatusUI() {
  if (state.counterStatus === 'BUSY') {
    buttons.toggleCounterStatus.innerText = '🔴 Sibuk';
    buttons.toggleCounterStatus.className = 'pill-btn pill-logout';
  } else {
    buttons.toggleCounterStatus.innerText = '🟢 Aktif';
    buttons.toggleCounterStatus.className = 'pill-btn pill-active';
  }
}

buttons.toggleCounterStatus.addEventListener('click', async () => {
  if (!state.selectedCounter) return;
  const newStatus = state.counterStatus === 'BUSY' ? 'STANDBY' : 'BUSY';
  try {
    await axios.put(`/counters/${state.selectedCounter}/status`, { status: newStatus });
    state.counterStatus = newStatus;
    updateCounterStatusUI();
  } catch (err) {
    alert(err.response?.data?.message || 'Gagal mengubah status counter');
  }
});

buttons.changeCounter.addEventListener('click', async () => {
  containers.counterModal.classList.add('active');
  updateCounterModalTitle();
  await loadCounters();
  highlightSelectedCounterBtn();
});

buttons.closeCounterModal.addEventListener('click', () => {
  containers.counterModal.classList.remove('active');
});

// saveCounter button removed - counter selection is now handled by button clicks directly

// --- DOCTORS & TICKETS GENERATOR ---
state.doctorOptionsMap = {};

async function loadDoctors() {
  const listEl = document.getElementById('doctorListOptions');
  if (listEl) listEl.innerHTML = '';
  state.doctorOptionsMap = {};

  try {
    // Try fetching today's active schedules first
    const schedRes = await axios.get('/schedules/active-today').catch(() => null);
    if (schedRes && Array.isArray(schedRes.data) && schedRes.data.length > 0) {
      state.schedules = schedRes.data;
      state.schedules.forEach(s => {
        const docName = s.doctor?.doctorName || s.doctorName || 'Dokter';
        const roomName = s.room?.name || s.roomName || '';
        const label = roomName ? `${docName} (${roomName})` : docName;
        
        state.doctorOptionsMap[label] = { id: s.id, doctorName: docName, isSchedule: true };
        
        if (listEl) {
          const opt = document.createElement('option');
          opt.value = label;
          listEl.appendChild(opt);
        }
      });
      return;
    }

    // Fallback to all doctors (/doctors)
    const res = await axios.get('/doctors');
    state.doctors = Array.isArray(res.data) ? res.data.filter(d => d.isActive !== false) : [];
    state.doctors.forEach(d => {
      const label = d.doctorName;
      state.doctorOptionsMap[label] = { id: d.id, doctorName: d.doctorName, isSchedule: false };
      
      if (listEl) {
        const opt = document.createElement('option');
        opt.value = label;
        listEl.appendChild(opt);
      }
    });
  } catch (err) {
    console.error("Gagal memuat dokter:", err);
  }
}

let toastTimer = null;
function showToast(message, isError = true) {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  if (!toast || !msgEl) return;

  msgEl.innerText = message;
  toast.style.background = isError ? '#ef4444' : '#1e293b';
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

if (inputs.doctorInput) {
  inputs.doctorInput.addEventListener('input', async (e) => {
    const val = e.target.value.trim();
    const match = state.doctorOptionsMap[val];

    if (match) {
      inputs.doctorTicketNoInput.disabled = false;
      inputs.doctorTicketNoInput.value = "";
      inputs.doctorTicketNoInput.placeholder = "⏳ Memuat no. tiket...";

      try {
        const res = await axios.get(`/admission/next-doctor-ticket?scheduleId=${match.id}`);
        if (res?.data?.nextDoctorTicketNo && inputs.doctorInput.value.trim() === val) {
          inputs.doctorTicketNoInput.value = res.data.nextDoctorTicketNo;
        }
      } catch (err) {
        const initials = match.doctorName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'DOC';
        inputs.doctorTicketNoInput.value = `${initials}001`;
      }
    } else {
      inputs.doctorTicketNoInput.disabled = true;
      inputs.doctorTicketNoInput.placeholder = "Pilih dokter dahulu...";
      inputs.doctorTicketNoInput.value = "";
    }
  });
}

async function refreshQueues() {
  try {
    const config = UNIT_CONFIG[state.activeTab] || UNIT_CONFIG.ADMISSION;
    
    let endpoint = config.queueEndpoint;
    if ((state.activeTab === 'ASSESSMENT' || state.activeTab === 'BDR' || state.activeTab === 'CDC') && state.selectedFloor) {
      endpoint += `?floorId=${state.selectedFloor}`;
    } else if (state.activeTab === 'DOCTOR' && state.selectedRoom && state.selectedRoom !== 'ALL') {
      endpoint += `?roomId=${state.selectedRoom}`;
    }

    console.log(`[Orbita Queue] Fetching queue for ${state.activeTab} from ${endpoint}`);
    const res = await axios.get(endpoint).catch(() => ({ data: [] }));

    const rawData = Array.isArray(res.data) ? res.data : (res.data?.waitingList || res.data?.queue || []);

    const isCashierTicket = (v) => {
      const ticketNo = v.doctorTicketNo || v.queueTicket?.ticketNo || v.ticketNo || '';
      return ticketNo.startsWith('G') || ticketNo.startsWith('H') || ticketNo.startsWith('K');
    };

    if (state.activeTab === 'CASHIER') {
      state.unitWaitingList = rawData.filter(v => {
        const s = v.journeySessions?.[0];
        return (s?.status === 'WAITING' || s?.status === 'SKIPPED') && isCashierTicket(v);
      });

      state.activeCall = rawData.filter(isCashierTicket).find(v => {
        const s = v.journeySessions?.[0];
        return s && ['CALLED', 'SERVING'].includes(s.status) && (s.counterId === state.selectedCounter || !state.selectedCounter);
      }) || null;

    } else if (state.activeTab === 'ASSESSMENT') {
      state.unitWaitingList = rawData.filter(v => {
        const s = v.journeySessions?.[0];
        return !s || s.status === 'WAITING' || s.status === 'SKIPPED';
      });

      state.activeCall = rawData.find(v => {
        const s = v.journeySessions?.[0];
        return s && ['CALLED', 'SERVING'].includes(s.status);
      }) || null;

    } else if (state.activeTab === 'BDR') {
      state.unitWaitingList = rawData.filter(v => {
        const s = v.journeySessions?.[0];
        return !s || s.status === 'WAITING' || s.status === 'SKIPPED';
      });

      state.activeCall = rawData.find(v => {
        const s = v.journeySessions?.[0];
        return s && ['CALLED', 'SERVING'].includes(s.status);
      }) || null;

    } else if (state.activeTab === 'CDC') {
      state.unitWaitingList = rawData.filter(v => {
        const s = v.journeySessions?.[0];
        return !s || s.status === 'WAITING' || s.status === 'SKIPPED';
      });

      state.activeCall = rawData.find(v => {
        const s = v.journeySessions?.[0];
        return s && ['CALLED', 'SERVING'].includes(s.status);
      }) || null;

    } else if (state.activeTab === 'DOCTOR') {
      state.unitWaitingList = rawData.filter(v => {
        const s = v.journeySessions?.[0];
        return !s || s.status === 'WAITING' || s.status === 'SKIPPED';
      });

      state.activeCall = rawData.find(v => {
        const s = v.journeySessions?.[0];
        return s && ['CALLED', 'SERVING'].includes(s.status);
      }) || null;

    } else {
      // ADMISSION
      state.unitWaitingList = rawData.filter(t => {
        const s = t.journeySessions?.[0] || t.visit?.journeySessions?.[0];
        const status = t.status || s?.status;
        return status === 'WAITING' || status === 'SKIPPED' || (t.status === 'IN_PROGRESS' && s?.status === 'SKIPPED');
      });

      state.activeCall = rawData.find(t => {
        const s = t.journeySessions?.[0] || t.visit?.journeySessions?.[0];
        return s && ['CALLED', 'SERVING'].includes(s.status) && (s.counterId === state.selectedCounter || !state.selectedCounter);
      }) || null;
    }

    const iconEl = document.getElementById('activeUnitIcon');
    const titleEl = document.getElementById('activeUnitTitle');
    const countEl = document.getElementById('countActiveUnit');
    const dotEl = document.getElementById('activeUnitDot');

    if (iconEl) iconEl.innerText = config.icon;
    if (titleEl) titleEl.innerText = config.label;
    if (countEl) countEl.innerText = state.unitWaitingList.length;
    if (dotEl) dotEl.style.display = state.unitWaitingList.length > 0 ? 'inline-block' : 'none';

    renderCurrentState();
    checkAutoPopupAndReminders(state.unitWaitingList.length);
  } catch (err) {
    console.error("refreshQueues error:", err);
  }
}

let lastWaitingCount = 0;
let servingReminderInterval = null;

function checkAutoPopupAndReminders(currentWaitingCount) {
  // 1. Pop-Up on New Ticket Arrival
  if (currentWaitingCount > lastWaitingCount && !state.activeCall) {
    ipcRenderer.send('show-window');
  }
  lastWaitingCount = currentWaitingCount;

  // 2. 1-Minute Recurring Reminder when Serving
  if (state.activeCall) {
    if (!servingReminderInterval) {
      servingReminderInterval = setInterval(() => {
        if (state.activeCall) {
          ipcRenderer.send('show-window');
        } else {
          clearInterval(servingReminderInterval);
          servingReminderInterval = null;
        }
      }, 60000); // 60 seconds
    }
  } else {
    if (servingReminderInterval) {
      clearInterval(servingReminderInterval);
      servingReminderInterval = null;
    }
  }
}

function updateNextUnitSelect() {
  const select = inputs.nextUnitSelect;
  if (!select) return;
  const config = UNIT_CONFIG[state.activeTab] || UNIT_CONFIG.ADMISSION;
  select.innerHTML = '';
  (config.destOptions || []).forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.innerText = opt.label;
    select.appendChild(option);
  });
}

// --- RENDER 3 STATES (MOCKUP 1, 2, & 3) ---
function renderCurrentState() {
  const config = UNIT_CONFIG[state.activeTab] || UNIT_CONFIG.ADMISSION;
  updateNextUnitSelect();

  if (state.activeCall) {
    // === STATE 1: ACTIVE CALL / SERVING (MOCKUP 1) ===
    containers.activeStateContainer.style.display = 'block';
    containers.activeControlsGrid.style.display = 'grid';

    const t = state.activeCall;
    const activeSessionStatus = t.journeySessions?.[0]?.status || t.status || 'SERVING';

    if (state.activeTab === 'ASSESSMENT' || state.activeTab === 'CDC') {
      if (buttons.recallBtn) buttons.recallBtn.style.display = 'none';
      if (buttons.startBtn) buttons.startBtn.style.display = 'none';
    } else {
      // ADMISSION, CASHIER, BDR, DOCTOR
      if (buttons.recallBtn) buttons.recallBtn.style.display = 'inline-block'; // 📢 Panggil Ulang
      if (buttons.startBtn) buttons.startBtn.style.display = 'none';
    }

    containers.idleStateContainer.style.display = 'none';
    containers.idleControlsBox.style.display = 'none';
    containers.manualControlsBox.style.display = 'none';

    const rawNo = t.ticketNo || t.doctorTicketNo || t.queueTicket?.ticketNo || 'A001';
    
    // Split prefix letter & numbers (e.g. B & 002)
    const match = rawNo.match(/^([A-Za-z]+)(\d+)$/);
    if (match) {
      texts.ticketPrefix.innerText = match[1];
      texts.ticketNum.innerText = match[2];
    } else {
      texts.ticketPrefix.innerText = rawNo.slice(0, 1);
      texts.ticketNum.innerText = rawNo.slice(1);
    }

    texts.activePatientType.innerText = t.patientType || t.visit?.patientType || 'Umum';

    const innerFormBox = document.getElementById('innerFormBox');
    const doctorFormRow = innerFormBox ? innerFormBox.children[0] : null;
    const ticketNoRow = innerFormBox ? innerFormBox.children[1] : null;

    if (config.hasDoctorForm) {
      innerFormBox.style.display = 'flex';
      if (doctorFormRow) doctorFormRow.style.display = 'flex';
      if (ticketNoRow) ticketNoRow.style.display = 'flex';
      
      // If patient changed or no last active call recorded, update/reset doctor input fields!
      if (state.lastActiveCallId !== t.id) {
        state.lastActiveCallId = t.id;
        
        const existingDocId = t.visit?.selectedDoctorId || t.selectedDoctorId || t.selectedDoctor?.id || t.visit?.selectedDoctor?.id;
        const existingTicketNo = t.doctorTicketNo || t.visit?.doctorTicketNo;

        let matchedLabel = '';
        if (existingDocId && state.doctorOptionsMap) {
          matchedLabel = Object.keys(state.doctorOptionsMap).find(lbl => state.doctorOptionsMap[lbl].id === existingDocId) || '';
        }

        if (!matchedLabel && (t.selectedDoctor || t.visit?.selectedDoctor)) {
          const docObj = t.selectedDoctor || t.visit?.selectedDoctor;
          if (docObj?.id && state.doctorOptionsMap) {
            matchedLabel = Object.keys(state.doctorOptionsMap).find(lbl => state.doctorOptionsMap[lbl].id === docObj.id) || '';
          }
        }

        if (matchedLabel) {
          if (inputs.doctorInput) inputs.doctorInput.value = matchedLabel;
          const match = state.doctorOptionsMap[matchedLabel];
          let finalTicketNo = existingTicketNo;
          if (!finalTicketNo && match) {
            const prefix = match.initials || match.code || 'DOC';
            const rawNo = t.ticketNo || t.queueTicket?.ticketNo || '001';
            const numMatch = rawNo.match(/\d+/);
            const numStr = numMatch ? numMatch[0] : '001';
            finalTicketNo = `${prefix}${numStr.padStart(3, '0')}`;
          }
          if (inputs.doctorTicketNoInput) {
            inputs.doctorTicketNoInput.value = finalTicketNo || '';
            inputs.doctorTicketNoInput.disabled = false;
          }
        } else {
          // Clear doctor inputs for new patient
          if (inputs.doctorInput) inputs.doctorInput.value = '';
          if (inputs.doctorTicketNoInput) {
            inputs.doctorTicketNoInput.value = '';
            inputs.doctorTicketNoInput.disabled = true;
            inputs.doctorTicketNoInput.placeholder = "Pilih dokter dahulu...";
          }
        }
      }
    } else if (config.hasDestSelect) {
      innerFormBox.style.display = 'flex';
      if (doctorFormRow) doctorFormRow.style.display = 'none';
      if (ticketNoRow) ticketNoRow.style.display = 'none';
    } else {
      innerFormBox.style.display = 'none';
    }

  } else if (state.isManualMode) {
    // === STATE 3: MANUAL TICKET GENERATOR (MOCKUP 3) ===
    containers.activeStateContainer.style.display = 'none';
    containers.activeControlsGrid.style.display = 'none';

    containers.idleStateContainer.style.display = 'flex';
    containers.idleStateContainer.innerHTML = `
      <div class="waiting-card-container" style="padding: 4px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:12px;font-weight:800;color:#1e3a8a;">🎟️ AMBIL TIKET BARU</span>
          <button onclick="window.cancelManualTicketMode()" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;padding:3px 10px;font-size:11px;font-weight:700;border-radius:6px;cursor:pointer;">❌ Batal</button>
        </div>
        <div id="centerCategoryGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:4px 0;"></div>
      </div>
    `;

    containers.idleControlsBox.style.display = 'none';
    containers.manualControlsBox.style.display = 'flex';

    renderCategoryGrid();

  } else {
    // === STATE 2: IDLE / WAITING QUEUE CARD (MOCKUP 2) ===
    containers.activeStateContainer.style.display = 'none';
    containers.activeControlsGrid.style.display = 'none';

    containers.idleStateContainer.style.display = 'flex';
    containers.idleControlsBox.style.display = 'flex';
    containers.manualControlsBox.style.display = 'none';

    const waitingList = state.unitWaitingList || [];
    if (waitingList.length > 0) {
      const itemsToShow = waitingList.slice(0, 3);
      
      const isStartMode = (state.activeTab === 'ASSESSMENT' || state.activeTab === 'CDC');
      const btnLabel = isStartMode ? '▶️ Mulai' : '📢 Panggil';
      const badgeTitle = isStartMode ? `⏱️ MENUNGGU DIKAJI (${waitingList.length})` : `⏱️ MENUNGGU DIPANGGIL (${waitingList.length})`;

      const rowsHtml = itemsToShow.map((t, idx) => {
        const rawNo = t.ticketNo || t.doctorTicketNo || t.queueTicket?.ticketNo || 'A001';
        const rawType = String(t.patientType || t.visit?.patientType || t.queueTicket?.patientType || 'BARU');
        const typeStr = rawType.toUpperCase();
        const tagClass = rawType.toLowerCase();
        const isFirst = idx === 0;
        
        const roomName = t.selectedRoom?.name || t.visit?.selectedRoom?.name || '';
        const roomBadge = (state.activeTab === 'DOCTOR' && roomName) ? `<span class="ticket-item-tag" style="background:#e0f2fe; color:#0369a1; margin-left:4px;">🚪 ${roomName}</span>` : '';

        return `
          <div class="waiting-ticket-item ${isFirst ? 'primary' : ''}">
            <div class="ticket-item-left">
              <span class="ticket-item-no">${rawNo}</span>
              <span class="ticket-item-tag ${tagClass}">${typeStr}</span>
              ${roomBadge}
            </div>
            <button class="btn-call-row" data-index="${idx}">
              ${btnLabel}
            </button>
          </div>
        `;
      }).join('');

      containers.idleStateContainer.innerHTML = `
        <div class="waiting-card-container">
          <div class="waiting-header-badge">${badgeTitle}</div>
          <div class="waiting-tickets-scroll">
            ${rowsHtml}
          </div>
        </div>
      `;

      const rowBtns = containers.idleStateContainer.querySelectorAll('.btn-call-row');
      rowBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.dataset.index);
          const targetTicket = itemsToShow[idx];
          if (targetTicket) callPatientInQueue(targetTicket);
        });
      });
    } else {
      containers.idleStateContainer.innerHTML = `<div class="empty-state-text">Antrean Kosong</div>`;
    }
  }
}

async function callPatientInQueue(item) {
  if (!state.selectedCounter) {
    alert("Silakan pilih loket terlebih dahulu!");
    containers.counterModal.classList.add('active');
    return;
  }
  const config = UNIT_CONFIG[state.activeTab] || UNIT_CONFIG.ADMISSION;
  const ticketId = item.id || item.visitId;
  try {
    await axios.post(config.callEndpoint(ticketId), { counterId: state.selectedCounter });
    await refreshQueues();
    ipcRenderer.send('show-window');
  } catch (err) {
    alert("Gagal memanggil antrean: " + (err.response?.data?.message || err.message));
  }
}

// --- DYNAMIC CATEGORY GRID (MOCKUP 3 - ADMISI: A-D, KASIR: G-H) ---
function renderCategoryGrid() {
  const centerGrid = document.getElementById('centerCategoryGrid');
  const bottomGrid = containers.categoryGrid;

  const isCashier = (state.activeTab === 'CASHIER');

  const cats = isCashier ? [
    { type: 'UMUM', code: 'G', label: '➕ Kasir Umum (G)', color: 'btn-blue', unit: 'CASHIER' },
    { type: 'ASURANSI', code: 'H', label: '➕ Kasir Asuransi (H)', color: 'btn-orange', unit: 'CASHIER' },
  ] : [
    { type: 'BARU', code: 'A', label: '➕ Baru (A)', color: 'btn-blue', unit: 'ADMISSION' },
    { type: 'LAMA', code: 'B', label: '➕ Lama (B)', color: 'btn-blue', unit: 'ADMISSION' },
    { type: 'ASURANSI', code: 'C', label: '➕ Asuransi (C)', color: 'btn-orange', unit: 'ADMISSION' },
    { type: 'ONLINE', code: 'D', label: '➕ Online (D)', color: 'btn-orange', unit: 'ADMISSION' },
  ];

  const html = cats.map(c => `
    <button type="button" class="btn-cat ${c.color}" style="padding:12px 6px;font-size:12px;font-weight:800;cursor:pointer;" onclick="window.createTicket('${c.unit}', '${c.type}')">
      ${c.label}
    </button>
  `).join('');

  if (centerGrid) centerGrid.innerHTML = html;
  if (bottomGrid) bottomGrid.innerHTML = html;
}

// --- STATE SWITCHING BUTTONS ---
if (buttons.openNewTicketBtn) {
  buttons.openNewTicketBtn.addEventListener('click', (e) => {
    e.preventDefault();
    window.toggleManualTicketMode();
  });
}

if (buttons.refreshHeaderBtn) {
  buttons.refreshHeaderBtn.addEventListener('click', () => {
    state.isManualMode = false;
    refreshQueues();
  });
}

if (buttons.refreshBtn) {
  buttons.refreshBtn.addEventListener('click', () => {
    refreshQueues();
  });
}

if (buttons.refreshBtn2) {
  buttons.refreshBtn2.addEventListener('click', () => {
    window.cancelManualTicketMode();
  });
}

// --- ACTIVE CONTROL BUTTONS (STATE 1) ---
async function executeFinishTicket() {
  if (!state.activeCall) return;
  const config = UNIT_CONFIG[state.activeTab] || UNIT_CONFIG.ADMISSION;
  const ticketId = state.activeCall.id || state.activeCall.visitId || state.activeCall.queueTicketId;
  const nextUnitType = inputs.nextUnitSelect ? inputs.nextUnitSelect.value : null;

  try {
    if (config.hasDoctorForm) {
      const docVal = inputs.doctorInput ? inputs.doctorInput.value.trim() : '';
      const ticketNoVal = inputs.doctorTicketNoInput ? inputs.doctorTicketNoInput.value.trim() : '';

      if (!docVal) {
        showToast("⚠️ Dokter Tujuan belum dipilih!");
        return;
      }

      if (!ticketNoVal) {
        showToast("⚠️ No. Tiket Dokter belum terisi!");
        return;
      }

      const match = state.doctorOptionsMap[docVal];
      if (match) {
        await axios.put(`/admission/${ticketId}/patient-data`, {
          scheduleId: match.id,
          doctorTicketNo: ticketNoVal
        }).catch(() => {});
      }
      await axios.post(config.finishEndpoint(ticketId), { nextUnitType });
    } else if (config.hasDestSelect) {
      await axios.post(config.finishEndpoint(ticketId), { nextUnitType });
    } else {
      await axios.post(config.finishEndpoint(ticketId));
    }
    state.activeCall = null;
    await refreshQueues();
  } catch (err) {
    showToast(err.response?.data?.message || "Gagal menyelesaikan antrean");
  }
}

buttons.finishBtn.addEventListener('click', async () => {
  if (!state.activeCall) return;

  const serviceStartedAt = state.activeCall?.visit?.serviceStartedAt || 
                           state.activeCall?.serviceStartedAt || 
                           state.activeCall?.journeySessions?.[0]?.createdAt ||
                           state.activeCall?.createdAt;
  
  const durationSeconds = serviceStartedAt ? Math.max(0, Math.round((Date.now() - new Date(serviceStartedAt).getTime()) / 1000)) : 60;

  if (durationSeconds < 60) {
    const textEl = document.getElementById('fastFinishSecondsText');
    if (textEl) textEl.textContent = `${durationSeconds} detik`;
    if (containers.fastFinishModal) containers.fastFinishModal.classList.add('active');
  } else {
    await executeFinishTicket();
  }
});

if (buttons.confirmFastFinish) {
  buttons.confirmFastFinish.addEventListener('click', async () => {
    if (containers.fastFinishModal) containers.fastFinishModal.classList.remove('active');
    await executeFinishTicket();
  });
}

if (buttons.cancelFastFinish) {
  buttons.cancelFastFinish.addEventListener('click', () => {
    if (containers.fastFinishModal) containers.fastFinishModal.classList.remove('active');
  });
}

if (buttons.closeFastFinishModal) {
  buttons.closeFastFinishModal.addEventListener('click', () => {
    if (containers.fastFinishModal) containers.fastFinishModal.classList.remove('active');
  });
}

if (buttons.startBtn) {
  buttons.startBtn.addEventListener('click', async () => {
    if (!state.activeCall) return;
    const config = UNIT_CONFIG[state.activeTab] || UNIT_CONFIG.ADMISSION;
    const ticketId = state.activeCall.id || state.activeCall.visitId || state.activeCall.queueTicketId;
    try {
      const startEndpoint = (state.activeTab === 'DOCTOR')
        ? `/doctor-queue/${ticketId}/start`
        : (state.activeTab === 'BDR')
          ? `/bdr/${ticketId}/start`
          : config.callEndpoint(ticketId);

      await axios.post(startEndpoint, { counterId: state.selectedCounter });
      showToast("▶️ Layanan dimulai!", false);
      await refreshQueues();
    } catch (err) {
      alert("Gagal memulai layanan: " + (err.response?.data?.message || err.message));
    }
  });
}

buttons.recallBtn.addEventListener('click', async () => {
  if (!state.activeCall || !state.selectedCounter) return;
  const config = UNIT_CONFIG[state.activeTab] || UNIT_CONFIG.ADMISSION;
  const ticketId = state.activeCall.id || state.activeCall.visitId || state.activeCall.queueTicketId;
  
  try {
    await axios.post(config.callEndpoint(ticketId), { counterId: state.selectedCounter });
    if (state.activeCall.visit) {
      state.activeCall.visit.serviceStartedAt = new Date().toISOString();
    } else {
      state.activeCall.serviceStartedAt = new Date().toISOString();
    }
    ipcRenderer.send('show-window');
    showToast("📢 Panggil ulang & timer di-reset ke 00:00!", false);
    await refreshQueues();
  } catch (err) {
    alert("Gagal panggil ulang: " + (err.response?.data?.message || err.message));
  }
});

buttons.holdBtn.addEventListener('click', async () => {
  if (!state.activeCall) return;
  const config = UNIT_CONFIG[state.activeTab] || UNIT_CONFIG.ADMISSION;
  const ticketId = state.activeCall.id || state.activeCall.visitId || state.activeCall.queueTicketId;

  try {
    await axios.post(config.holdEndpoint(ticketId));
    state.activeCall = null;
    await refreshQueues();
  } catch (err) {
    alert(err.response?.data?.message || "Gagal me-hold antrean");
  }
});

buttons.cancelBtn.addEventListener('click', () => {
  if (!state.activeCall) return;
  state.targetCancelTicket = state.activeCall;
  inputs.cancelReasonInput.value = '';
  containers.cancelModal.classList.add('active');
});

buttons.closeCancelModal.addEventListener('click', () => {
  containers.cancelModal.classList.remove('active');
});

document.getElementById('cancelForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.targetCancelTicket) return;
  const config = UNIT_CONFIG[state.activeTab] || UNIT_CONFIG.ADMISSION;
  const reason = inputs.cancelReasonInput.value.trim();
  const ticketId = state.targetCancelTicket.id || state.targetCancelTicket.visitId || state.targetCancelTicket.queueTicketId;

  try {
    await axios.post(config.cancelEndpoint(ticketId), { reason });
    containers.cancelModal.classList.remove('active');
    state.targetCancelTicket = null;
    state.activeCall = null;
    await refreshQueues();
  } catch (err) {
    alert(err.response?.data?.message || "Gagal membatalkan antrean");
  }
});

// --- SOCKET.IO REALTIME ENGINE ---
function initSocket() {
  if (state.socket) return;
  const socketUrl = cleanServerUrl(state.serverUrl);
  
  state.socket = io(socketUrl, {
    transports: ['websocket', 'polling']
  });
  
  const handleRefresh = () => {
    refreshQueues().then(() => {
      if (state.activeCall) {
        ipcRenderer.send('show-window');
      }
    });
  };

  state.socket.on('queue-updated', handleRefresh);
  state.socket.on('queueUpdate', handleRefresh);
  state.socket.on('dashboard-refresh', handleRefresh);
  state.socket.on('dashboardRefresh', handleRefresh);
  state.socket.on('displayRefresh', handleRefresh);

  state.socket.on('counterStatusChanged', (data) => {
    if (data.counterId === state.selectedCounter) {
      state.counterStatus = data.status;
      updateCounterStatusUI();
    }
  });
}

// --- AUTO-UPDATE ENGINE (1-CLICK UPDATE) ---
const CURRENT_APP_VERSION = '1.0.0';
let activeUpdateInfo = null;

async function checkAppUpdate(isManualCheck = false) {
  try {
    const serverUrl = cleanServerUrl(getInitialServerUrl());
    const checkEndpoint = `${serverUrl}/api/app-update/check?currentVersion=${CURRENT_APP_VERSION}`;
    
    console.log('[Orbita Update] Checking update from:', checkEndpoint);
    const res = await fetch(checkEndpoint).then(r => r.json()).catch(() => null);

    if (!res || !res.hasUpdate) {
      if (isManualCheck) {
        showToast(`✅ Aplikasi sudah versi terbaru (v${CURRENT_APP_VERSION}).`);
      }
      return;
    }

    activeUpdateInfo = res;
    showUpdateModal(res);
  } catch (err) {
    console.error('[Orbita Update] Check error:', err);
    if (isManualCheck) {
      showToast("❌ Gagal memeriksa pembaruan server.");
    }
  }
}

function showUpdateModal(info) {
  const modal = document.getElementById('updateModal');
  const badge = document.getElementById('updateVersionBadge');
  const notes = document.getElementById('updateNotes');
  const progressContainer = document.getElementById('updateProgressContainer');
  const modalBtns = document.getElementById('updateModalBtns');

  if (!modal) return;

  if (badge) badge.innerText = `Versi Rilis v${info.latestVersion} (Versi Anda: v${CURRENT_APP_VERSION})`;
  if (notes) notes.innerText = info.releaseNotes || 'Pembaruan stabilitas dan fitur baru.';
  
  if (progressContainer) progressContainer.style.display = 'none';
  if (modalBtns) modalBtns.style.display = 'flex';

  modal.classList.add('active');
}

document.getElementById('closeUpdateModalBtn')?.addEventListener('click', () => {
  document.getElementById('updateModal')?.classList.remove('active');
});

document.getElementById('btnSkipUpdate')?.addEventListener('click', () => {
  document.getElementById('updateModal')?.classList.remove('active');
});

document.getElementById('btnDoUpdate')?.addEventListener('click', async () => {
  if (!activeUpdateInfo || !activeUpdateInfo.downloadUrl) return;

  const modalBtns = document.getElementById('updateModalBtns');
  const progressContainer = document.getElementById('updateProgressContainer');
  const progressBar = document.getElementById('updateProgressBar');
  const progressText = document.getElementById('updateProgressText');

  if (modalBtns) modalBtns.style.display = 'none';
  if (progressContainer) progressContainer.style.display = 'block';

  try {
    const downloadUrl = activeUpdateInfo.downloadUrl;
    console.log('[Orbita Update] Downloading update from:', downloadUrl);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 15;
      if (progress > 90) clearInterval(interval);
      if (progressBar) progressBar.style.width = `${Math.min(progress, 90)}%`;
      if (progressText) progressText.innerText = `Mengunduh & memasang... ${Math.min(progress, 90)}%`;
    }, 300);

    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const tempDir = os.tmpdir();
    const zipPath = path.join(tempDir, 'OrbitaQueueCaller-update.zip');
    fs.writeFileSync(zipPath, Buffer.from(buffer));

    clearInterval(interval);
    if (progressBar) progressBar.style.width = '100%';
    if (progressText) progressText.innerText = '✅ Pembaruan selesai! Memuat ulang aplikasi...';

    setTimeout(() => {
      ipcRenderer.send('relaunch-app');
    }, 1200);

  } catch (err) {
    console.error('[Orbita Update] Download error:', err);
    if (progressText) progressText.innerText = '❌ Gagal mengunduh update: ' + err.message;
    if (modalBtns) modalBtns.style.display = 'flex';
  }
});

// Auto check update 3 seconds after load
setTimeout(() => {
  checkAppUpdate(false);
}, 3000);
