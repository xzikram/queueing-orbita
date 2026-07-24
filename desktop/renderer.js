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
  counterStatus: 'STANDBY',
  doctors: [],
  schedules: [],
  selectedCounter: localStorage.getItem('orbita_selected_counter') || null,
  activeTab: 'ADMISSION', // 'ADMISSION' | 'CASHIER'
  admissionList: [],
  cashierList: [],
  activeCall: null,
  isManualMode: false,
  clockTimer: null,

  targetCancelTicket: null,
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
  countAdmisi: document.getElementById('countAdmisi'),
  countKasir: document.getElementById('countKasir'),
  admisiDot: document.getElementById('admisiDot'),
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
  tabAdmisi: document.getElementById('tabAdmisi'),
  tabKasir: document.getElementById('tabKasir'),
  minBtn: document.getElementById('minBtn'),
  finishBtn: document.getElementById('finishBtn'),
  recallBtn: document.getElementById('recallBtn'),
  holdBtn: document.getElementById('holdBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  closeCancelModal: document.getElementById('closeCancelModalBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  refreshBtn2: document.getElementById('refreshBtn2'),
  openNewTicketBtn: document.getElementById('openNewTicketBtn'),
};

const containers = {
  activeStateContainer: document.getElementById('activeStateContainer'),
  idleStateContainer: document.getElementById('idleStateContainer'),
  activeControlsGrid: document.getElementById('activeControlsGrid'),
  idleControlsBox: document.getElementById('idleControlsBox'),
  manualControlsBox: document.getElementById('manualControlsBox'),
  counterModal: document.getElementById('counterModal'),
  cancelModal: document.getElementById('cancelModal'),
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

// --- CALLER SCREEN ENGINE ---
async function initCallerScreen() {
  showScreen('caller');
  texts.userName.innerText = state.user.name || 'Administrator';

  startLiveClock();
  await loadCounters();
  await loadDoctors();
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

// --- UNIT SELECTOR DROPDOWN (ADMISI VS KASIR) ---
inputs.unitSelect.addEventListener('change', (e) => {
  const val = e.target.value;
  state.activeTab = val;
  if (val === 'ADMISSION') {
    buttons.tabAdmisi.classList.add('active');
    buttons.tabKasir.classList.remove('active');
  } else {
    buttons.tabKasir.classList.add('active');
    buttons.tabAdmisi.classList.remove('active');
  }
  renderCurrentState();
});

buttons.tabAdmisi.addEventListener('click', () => {
  state.activeTab = 'ADMISSION';
  inputs.unitSelect.value = 'ADMISSION';
  buttons.tabAdmisi.classList.add('active');
  buttons.tabKasir.classList.remove('active');
  renderCurrentState();
});

buttons.tabKasir.addEventListener('click', () => {
  state.activeTab = 'CASHIER';
  inputs.unitSelect.value = 'CASHIER';
  buttons.tabKasir.classList.add('active');
  buttons.tabAdmisi.classList.remove('active');
  renderCurrentState();
});

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

function renderCounterButtons() {
  const list = inputs.counterButtonList;
  list.innerHTML = '';
  if (state.counters.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:16px;color:#94a3b8;font-weight:600;">Tidak ada counter tersedia</div>';
    return;
  }
  state.counters.forEach(c => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'counter-btn';
    btn.dataset.counterId = c.id;
    btn.innerHTML = `<span class="counter-icon">📍</span> ${c.name}`;
    btn.addEventListener('click', () => selectCounter(c.id));
    list.appendChild(btn);
  });
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
    b.classList.toggle('selected', b.dataset.counterId === state.selectedCounter);
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
  const current = state.counters.find(c => c.id === state.selectedCounter);
  texts.currentCounterName.innerText = current ? current.name : 'Loket';
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

if (inputs.doctorInput) {
  inputs.doctorInput.addEventListener('input', async (e) => {
    const val = e.target.value.trim();
    const match = state.doctorOptionsMap[val];

    if (match) {
      inputs.doctorTicketNoInput.disabled = false;
      inputs.doctorTicketNoInput.placeholder = "Contoh: MA020";

      try {
        const res = await axios.get(`/admission/next-doctor-ticket?scheduleId=${match.id}`).catch(() => null);
        if (res?.data?.nextDoctorTicketNo) {
          inputs.doctorTicketNoInput.value = res.data.nextDoctorTicketNo;
          return;
        }
      } catch (err) {}

      // Fallback ticket generation
      const initials = match.doctorName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'MA';
      const randomNum = String(Math.floor(Math.random() * 90) + 10).padStart(3, '0');
      inputs.doctorTicketNoInput.value = `${initials}${randomNum}`;
    } else {
      inputs.doctorTicketNoInput.disabled = true;
      inputs.doctorTicketNoInput.placeholder = "Pilih dokter dahulu...";
      inputs.doctorTicketNoInput.value = "";
    }
  });
}

// --- QUEUE FETCHING ---
async function refreshQueues() {
  try {
    const [admRes, kasRes] = await Promise.all([
      axios.get('/admission/queue').catch(() => ({ data: [] })),
      axios.get('/cashier/queue').catch(() => ({ data: [] }))
    ]);

    const admData = Array.isArray(admRes.data) ? admRes.data : (admRes.data?.waitingList || []);
    const kasData = Array.isArray(kasRes.data) ? kasRes.data : (kasRes.data?.waitingList || []);

    state.admissionList = admData.filter(t => {
      const session = t.visit?.journeySessions?.[0];
      return t.status === 'WAITING' || (t.status === 'IN_PROGRESS' && session?.status === 'SKIPPED');
    });

    const isCashierTicket = (v) => {
      const ticketNo = v.doctorTicketNo || v.queueTicket?.ticketNo || v.ticketNo || '';
      return ticketNo.startsWith('G') || ticketNo.startsWith('H') || ticketNo.startsWith('K');
    };

    const allCashWaiting = kasData.filter(v => {
      const s = v.journeySessions?.[0];
      return s?.status === 'WAITING' || s?.status === 'SKIPPED';
    });

    // Only direct Kiosk Kasir tickets (G, H) appear under Kasir waiting list!
    state.cashierList = allCashWaiting.filter(isCashierTicket);

    // Active Calls (ONLY for the currently selected Counter!)
    const activeAdm = admData.find(t => {
      const s = t.visit?.journeySessions?.[0];
      return t.status === 'IN_PROGRESS' && s && ['CALLED', 'SERVING'].includes(s.status) && s.counterId === state.selectedCounter;
    });

    const activeKas = kasData.filter(isCashierTicket).find(v => {
      const s = v.journeySessions?.[0];
      return s && ['CALLED', 'SERVING'].includes(s.status) && s.counterId === state.selectedCounter;
    });

    if (state.activeTab === 'ADMISSION') {
      state.activeCall = activeAdm || null;
    } else {
      state.activeCall = activeKas || null;
    }

    texts.countAdmisi.innerText = state.admissionList.length;
    texts.countKasir.innerText = state.cashierList.length;
    texts.admisiDot.style.display = state.admissionList.length > 0 ? 'inline-block' : 'none';

    renderCurrentState();
  } catch (err) {}
}

// --- RENDER 3 STATES (MOCKUP 1, 2, & 3) ---
function renderCurrentState() {
  if (state.activeCall) {
    // === STATE 1: ACTIVE CALL / SERVING (MOCKUP 1) ===
    containers.activeStateContainer.style.display = 'block';
    containers.activeControlsGrid.style.display = 'grid';

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

    if (state.activeTab === 'ADMISSION') {
      document.getElementById('innerFormBox').style.display = 'flex';
      if (t.visit?.selectedDoctorId || t.selectedDoctorId) {
        inputs.doctorSelect.value = t.visit?.selectedDoctorId || t.selectedDoctorId;
      }
    } else {
      document.getElementById('innerFormBox').style.display = 'none';
    }

  } else if (state.isManualMode) {
    // === STATE 3: MANUAL TICKET GENERATOR (MOCKUP 3) ===
    containers.activeStateContainer.style.display = 'none';
    containers.activeControlsGrid.style.display = 'none';

    containers.idleStateContainer.style.display = 'flex';
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

    const waitingList = state.activeTab === 'ADMISSION' ? state.admissionList : state.cashierList;
    if (waitingList.length > 0) {
      const itemsToShow = waitingList.slice(0, 3);
      
      const rowsHtml = itemsToShow.map((t, idx) => {
        const rawNo = t.ticketNo || t.doctorTicketNo || t.queueTicket?.ticketNo || 'A001';
        const typeStr = t.patientType || t.visit?.patientType || 'BARU';
        const isFirst = idx === 0;
        
        return `
          <div class="waiting-ticket-item ${isFirst ? 'primary' : ''}">
            <div class="ticket-item-left">
              <span class="ticket-item-no">${rawNo}</span>
              <span class="ticket-item-tag ${typeStr.toLowerCase()}">${typeStr}</span>
            </div>
            <button class="btn-call-row" data-index="${idx}">
              📢 Panggil
            </button>
          </div>
        `;
      }).join('');

      containers.idleStateContainer.innerHTML = `
        <div class="waiting-card-container">
          <div class="waiting-header-badge">⏱️ MENUNGGU DIPANGGIL (${waitingList.length})</div>
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
  try {
    if (state.activeTab === 'ADMISSION') {
      const ticketId = item.id;
      await axios.post(`/admission/${ticketId}/call`, { counterId: state.selectedCounter });
    } else {
      const visitId = item.id || item.visitId;
      await axios.post(`/cashier/${visitId}/call`, { counterId: state.selectedCounter });
    }
    await refreshQueues();
    ipcRenderer.send('show-window');
  } catch (err) {
    alert("Gagal memanggil antrean: " + (err.response?.data?.message || err.message));
  }
}

// --- DYNAMIC CATEGORY GRID (MOCKUP 3 - ADMISI: A-D, KASIR: G-H) ---
function renderCategoryGrid() {
  containers.categoryGrid.innerHTML = '';

  if (state.activeTab === 'ADMISSION') {
    // Admisi Categories: BARU (A), LAMA (B), ASURANSI (C), ONLINE (D)
    const cats = [
      { type: 'BARU', code: 'A', label: '➕ Baru (A)', color: 'btn-blue' },
      { type: 'LAMA', code: 'B', label: '➕ Lama (B)', color: 'btn-blue' },
      { type: 'ASURANSI', code: 'C', label: '➕ Asuransi (C)', color: 'btn-orange' },
      { type: 'ONLINE', code: 'D', label: '➕ Online (D)', color: 'btn-orange' },
    ];

    cats.forEach(c => {
      const btn = document.createElement('button');
      btn.className = `btn-cat ${c.color}`;
      btn.innerText = c.label;
      btn.addEventListener('click', () => createTicket('ADMISSION', c.type));
      containers.categoryGrid.appendChild(btn);
    });

  } else {
    // Kasir Categories: UMUM (G), ASURANSI (H)
    const cats = [
      { type: 'UMUM', code: 'G', label: '➕ Kasir Umum (G)', color: 'btn-blue' },
      { type: 'ASURANSI', code: 'H', label: '➕ Kasir Asuransi (H)', color: 'btn-orange' },
    ];

    cats.forEach(c => {
      const btn = document.createElement('button');
      btn.className = `btn-cat ${c.color}`;
      btn.innerText = c.label;
      btn.addEventListener('click', () => createTicket('CASHIER', c.type));
      containers.categoryGrid.appendChild(btn);
    });
  }
}

async function createTicket(unit, patientType) {
  try {
    if (unit === 'ADMISSION') {
      await axios.post('/queue-tickets/admission', { patientType });
    } else {
      await axios.post('/queue-tickets/cashier', { patientType });
    }
    state.isManualMode = false;
    await refreshQueues();
    ipcRenderer.send('show-window');
  } catch (err) {
    alert("Gagal mengambil antrean: " + (err.response?.data?.message || err.message));
  }
}

// --- STATE SWITCHING BUTTONS ---
buttons.openNewTicketBtn.addEventListener('click', () => {
  state.isManualMode = true;
  renderCurrentState();
});

buttons.refreshBtn.addEventListener('click', () => {
  state.isManualMode = false;
  refreshQueues();
});

buttons.refreshBtn2.addEventListener('click', () => {
  state.isManualMode = false;
  refreshQueues();
});

// --- ACTIVE CONTROL BUTTONS (STATE 1 - MOCKUP 1) ---
buttons.finishBtn.addEventListener('click', async () => {
  if (!state.activeCall) return;
  const ticketId = state.activeCall.id;
  const nextUnitType = inputs.nextUnitSelect.value || 'ASSESSMENT';

  try {
    if (state.activeTab === 'ADMISSION') {
      const docVal = inputs.doctorInput ? inputs.doctorInput.value.trim() : '';
      const match = state.doctorOptionsMap[docVal];
      if (match) {
        await axios.put(`/admission/${ticketId}/patient-data`, {
          scheduleId: match.id,
          doctorTicketNo: inputs.doctorTicketNoInput.value
        }).catch(() => {});
      }
      await axios.post(`/admission/${ticketId}/finish`, { nextUnitType });
    } else {
      await axios.post(`/cashier/${ticketId}/finish`);
    }
    state.activeCall = null;
    await refreshQueues();
  } catch (err) {
    alert("Gagal menyelesaikan: " + (err.response?.data?.message || err.message));
  }
});

buttons.recallBtn.addEventListener('click', async () => {
  if (!state.activeCall || !state.selectedCounter) return;
  const ticketId = state.activeCall.id || state.activeCall.queueTicketId;
  const endpoint = state.activeTab === 'ADMISSION' ? `/admission/${ticketId}/call` : `/cashier/${ticketId}/call`;
  
  try {
    await axios.post(endpoint, { counterId: state.selectedCounter });
    ipcRenderer.send('show-window');
  } catch (err) {
    alert("Gagal panggil ulang: " + (err.response?.data?.message || err.message));
  }
});

buttons.holdBtn.addEventListener('click', async () => {
  if (!state.activeCall) return;
  const ticketId = state.activeCall.id;
  const prefix = state.activeTab === 'ADMISSION' ? 'admission' : 'cashier';

  try {
    await axios.post(`/${prefix}/${ticketId}/hold`);
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
  const reason = inputs.cancelReasonInput.value.trim();

  try {
    const prefix = state.activeTab === 'ADMISSION' ? 'admission' : 'cashier';
    await axios.post(`/${prefix}/${state.targetCancelTicket.id}/cancel`, { reason });
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
