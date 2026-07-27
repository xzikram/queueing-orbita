const axios = require('axios');
const io = require('socket.io-client');
const { ipcRenderer } = require('electron');

const DEFAULT_SERVER_URL = 'http://192.168.40.131:3001';

let state = {
  token: localStorage.getItem('orbita_token') || null,
  user: JSON.parse(localStorage.getItem('orbita_user') || 'null'),
  serverUrl: localStorage.getItem('orbita_server_url') || DEFAULT_SERVER_URL,
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

function setupAxios() {
  axios.defaults.baseURL = state.serverUrl.replace(/\/$/, '') + '/api';
  axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
}

// --- LOGIN & LOGOUT ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = inputs.serverUrl.value.trim().replace(/\/$/, '');
  const email = inputs.email.value.trim();
  const password = inputs.password.value;

  try {
    buttons.login.disabled = true;
    texts.loginError.innerText = "Menghubungkan ke server...";

    const res = await axios.post(`${url}/api/auth/login`, { email, password });
    
    state.serverUrl = url;
    state.token = res.data.access_token;
    state.user = res.data.user;

    localStorage.setItem('orbita_server_url', url);
    localStorage.setItem('orbita_token', state.token);
    localStorage.setItem('orbita_user', JSON.stringify(state.user));

    setupAxios();
    initCallerScreen();

  } catch (err) {
    texts.loginError.innerText = "Login gagal: " + (err.response?.data?.message || err.message);
  } finally {
    buttons.login.disabled = false;
  }
});

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
  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get('role') || 'ALL';
  console.log('[Orbita] applyRoleUnitFiltering -> role:', role);

  const allowedUnits = {
    ADMISI_KASIR: ['ADMISSION', 'CASHIER'],
    PENGKAJIAN_CDC_DOKTER: ['ASSESSMENT', 'CDC', 'DOCTOR'],
    BDR: ['BDR'],
    ALL: ['ADMISSION', 'ASSESSMENT', 'DOCTOR', 'BDR', 'CDC', 'CASHIER']
  }[role] || ['ADMISSION', 'ASSESSMENT', 'DOCTOR', 'BDR', 'CDC', 'CASHIER'];

  const select = inputs.unitSelect;
  if (!select) return;

  const unitMap = {
    ADMISSION: '🏢 Admisi',
    ASSESSMENT: '📋 Pengkajian',
    DOCTOR: '🩺 Dokter (Poli)',
    BDR: '🩸 BDR',
    CDC: '🔬 CDC',
    CASHIER: '💳 Kasir'
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
    state.rooms = all.filter(r => ['DOCTOR', 'DOCTOR_CHILD'].includes(r.roomType));
    if (state.rooms.length > 0 && (!state.selectedRoom || !state.rooms.some(r => r.id === state.selectedRoom))) {
      state.selectedRoom = state.rooms[0].id;
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
    } else if (state.activeTab === 'DOCTOR' && state.selectedRoom) {
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

    if (state.activeTab === 'ASSESSMENT' || state.activeTab === 'CDC') {
      if (buttons.recallBtn) buttons.recallBtn.style.display = 'none';
      if (buttons.startBtn) buttons.startBtn.style.display = 'inline-block';
    } else {
      if (buttons.recallBtn) buttons.recallBtn.style.display = 'inline-block';
      if (buttons.startBtn) buttons.startBtn.style.display = 'none';
    }

    containers.idleStateContainer.style.display = 'none';
    containers.idleControlsBox.style.display = 'none';
    containers.manualControlsBox.style.display = 'none';

    const t = state.activeCall;
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
        
        const existingDocId = t.visit?.selectedDoctorId || t.selectedDoctorId;
        const existingTicketNo = t.doctorTicketNo || t.visit?.doctorTicketNo;

        let matchedLabel = '';
        if (existingDocId && state.doctorOptionsMap) {
          matchedLabel = Object.keys(state.doctorOptionsMap).find(lbl => state.doctorOptionsMap[lbl].id === existingDocId) || '';
        }

        if (matchedLabel) {
          if (inputs.doctorInput) inputs.doctorInput.value = matchedLabel;
          if (inputs.doctorTicketNoInput) {
            inputs.doctorTicketNoInput.value = existingTicketNo || '';
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
        
        return `
          <div class="waiting-ticket-item ${isFirst ? 'primary' : ''}">
            <div class="ticket-item-left">
              <span class="ticket-item-no">${rawNo}</span>
              <span class="ticket-item-tag ${tagClass}">${typeStr}</span>
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
    const ticketId = state.activeCall.id || state.activeCall.queueTicketId;
    try {
      await axios.post(config.callEndpoint(ticketId), { counterId: state.selectedCounter });
      showToast("▶️ Layanan dimulai!");
      await refreshQueues();
    } catch (err) {
      alert("Gagal memulai layanan: " + (err.response?.data?.message || err.message));
    }
  });
}

buttons.recallBtn.addEventListener('click', async () => {
  if (!state.activeCall || !state.selectedCounter) return;
  const config = UNIT_CONFIG[state.activeTab] || UNIT_CONFIG.ADMISSION;
  const ticketId = state.activeCall.id || state.activeCall.queueTicketId;
  
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
  const ticketId = state.activeCall.id;

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

  try {
    await axios.post(config.cancelEndpoint(state.targetCancelTicket.id), { reason });
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
  
  state.socket = io(state.serverUrl, {
    transports: ['websocket', 'polling']
  });
  
  state.socket.on('queue-updated', () => {
    refreshQueues().then(() => {
      if (state.activeCall) {
        ipcRenderer.send('show-window');
      }
    });
  });

  state.socket.on('dashboard-refresh', () => {
    refreshQueues();
  });

  state.socket.on('counterStatusChanged', (data) => {
    if (data.counterId === state.selectedCounter) {
      state.counterStatus = data.status;
      updateCounterStatusUI();
    }
  });
}
