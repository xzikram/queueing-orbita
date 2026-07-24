const axios = require('axios');
const io = require('socket.io-client');
const { ipcRenderer } = require('electron');

// DEFAULT SERVER URL (IP Server Rumah Sakit)
const DEFAULT_SERVER_URL = 'http://192.168.40.131:3001';

let state = {
  token: localStorage.getItem('orbita_token') || null,
  user: JSON.parse(localStorage.getItem('orbita_user') || 'null'),
  serverUrl: localStorage.getItem('orbita_server_url') || DEFAULT_SERVER_URL,
  socket: null,
  counters: [],
  doctors: [],
  selectedCounter: localStorage.getItem('orbita_selected_counter') || null,
  activeTab: 'ADMISSION', // 'ADMISSION' | 'CASHIER'
  admissionList: [],
  cashierList: [],
  activeCall: null, // Currently serving/called ticket
  isAlwaysOnTop: true,
  reminderTimer: null,
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
  counterSelect: document.getElementById('counterSelect'),
  doctorSelect: document.getElementById('doctorSelect')
};

const texts = {
  loginError: document.getElementById('loginError'),
  userName: document.getElementById('userName'),
  userRole: document.getElementById('userRole'),
  activeTicketNo: document.getElementById('activeTicketNo'),
  activePatientName: document.getElementById('activePatientName'),
  activeUnitBadge: document.getElementById('activeUnitBadge'),
  countAdmisi: document.getElementById('countAdmisi'),
  countKasir: document.getElementById('countKasir'),
  hiddenCountNum: document.getElementById('hiddenCountNum'),
  statusLog: document.getElementById('statusLog')
};

const buttons = {
  login: document.getElementById('loginBtn'),
  logout: document.getElementById('logoutBtn'),
  tabAdmisi: document.getElementById('tabAdmisi'),
  tabKasir: document.getElementById('tabKasir'),
  callNext: document.getElementById('callNextBtn'),
  recall: document.getElementById('recallBtn'),
  finishDefault: document.getElementById('finishDefaultBtn'),
  openManual: document.getElementById('openManualBtn'),
  closeManual: document.getElementById('closeManualBtn'),
  minBtn: document.getElementById('minBtn'),
  closeBtn: document.getElementById('closeBtn'),
  alwaysOnTopBtn: document.getElementById('alwaysOnTopBtn')
};

const containers = {
  activeActions: document.getElementById('activeActions'),
  admisiDoctorBox: document.getElementById('admisiDoctorBox'),
  quickRouteBox: document.getElementById('quickRouteBox'),
  waitingListContainer: document.getElementById('waitingListContainer'),
  hiddenCountIndicator: document.getElementById('hiddenCountIndicator'),
  manualModal: document.getElementById('manualModal')
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
buttons.minBtn.addEventListener('click', () => {
  ipcRenderer.send('minimize-window');
});

buttons.closeBtn.addEventListener('click', () => {
  ipcRenderer.send('close-window');
});

buttons.alwaysOnTopBtn.addEventListener('click', () => {
  state.isAlwaysOnTop = !state.isAlwaysOnTop;
  ipcRenderer.send('toggle-always-on-top', state.isAlwaysOnTop);
  buttons.alwaysOnTopBtn.style.opacity = state.isAlwaysOnTop ? '1' : '0.4';
  log(state.isAlwaysOnTop ? "Always-on-top AKTIF" : "Always-on-top NONAKTIF");
});

// --- HELPERS ---
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function log(msg) {
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  texts.statusLog.innerText = `[${time}] ${msg}`;
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
    log("Login berhasil. Selamat bertugas!");

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
  stopReminderTimer();
  showScreen('login');
});

// --- CALLER SCREEN ENGINE ---
async function initCallerScreen() {
  showScreen('caller');
  texts.userName.innerText = state.user.name;
  texts.userRole.innerText = state.user.role;

  await loadCounters();
  await loadDoctors();
  await refreshQueues();
  initSocket();
  startReminderTimer();
}

async function loadCounters() {
  try {
    const res = await axios.get('/counters');
    state.counters = res.data.filter(c => c.isActive);
    inputs.counterSelect.innerHTML = '';
    
    state.counters.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.innerText = c.name;
      inputs.counterSelect.appendChild(opt);
    });

    if (state.selectedCounter && state.counters.some(c => c.id === state.selectedCounter)) {
      inputs.counterSelect.value = state.selectedCounter;
    } else if (state.counters.length > 0) {
      state.selectedCounter = state.counters[0].id;
      inputs.counterSelect.value = state.selectedCounter;
      localStorage.setItem('orbita_selected_counter', state.selectedCounter);
    }
  } catch (err) {
    log("Gagal memuat loket: " + err.message);
  }
}

inputs.counterSelect.addEventListener('change', (e) => {
  state.selectedCounter = e.target.value;
  localStorage.setItem('orbita_selected_counter', state.selectedCounter);
  log(`Loket aktif diganti ke ${e.target.options[e.target.selectedIndex].text}`);
});

async function loadDoctors() {
  try {
    const res = await axios.get('/master/doctors');
    state.doctors = Array.isArray(res.data) ? res.data.filter(d => d.isActive) : [];
    inputs.doctorSelect.innerHTML = '<option value="">-- Pilih Dokter / Klinik --</option>';
    state.doctors.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.innerText = `${d.doctorName} (${d.specialty || 'Poli'})`;
      inputs.doctorSelect.appendChild(opt);
    });
  } catch (err) {
    // Ignore doctor load error if endpoint differs
  }
}

// --- TAB SWITCHING ---
buttons.tabAdmisi.addEventListener('click', () => {
  state.activeTab = 'ADMISSION';
  buttons.tabAdmisi.classList.add('active');
  buttons.tabKasir.classList.remove('active');
  renderCurrentTab();
});

buttons.tabKasir.addEventListener('click', () => {
  state.activeTab = 'CASHIER';
  buttons.tabKasir.classList.add('active');
  buttons.tabAdmisi.classList.remove('active');
  renderCurrentTab();
});

// --- QUEUE FETCHING & RENDERING ---
async function refreshQueues() {
  try {
    const [admRes, kasRes] = await Promise.all([
      axios.get('/admission/queue').catch(() => ({ data: [] })),
      axios.get('/cashier/queue').catch(() => ({ data: [] }))
    ]);

    const admData = Array.isArray(admRes.data) ? admRes.data : (admRes.data?.waitingList || []);
    const kasData = Array.isArray(kasRes.data) ? kasRes.data : (kasRes.data?.waitingList || []);

    // Filter waiting vs active
    state.admissionList = admData.filter(t => t.status === 'WAITING' || !t.visit);
    state.cashierList = kasData.filter(t => t.status === 'WAITING' || !t.visit);

    // Check active call for selected counter
    const activeAdm = admData.find(t => t.visit?.currentStatus === 'SERVING' || t.visit?.currentStatus === 'CALLED');
    const activeKas = kasData.find(t => t.visit?.currentStatus === 'SERVING' || t.visit?.currentStatus === 'CALLED');

    // Update active call state
    if (state.activeTab === 'ADMISSION') {
      state.activeCall = activeAdm || null;
    } else {
      state.activeCall = activeKas || null;
    }

    texts.countAdmisi.innerText = state.admissionList.length;
    texts.countKasir.innerText = state.cashierList.length;

    renderCurrentTab();
  } catch (err) {
    log("Gagal memperbarui antrean: " + err.message);
  }
}

function renderCurrentTab() {
  const currentList = state.activeTab === 'ADMISSION' ? state.admissionList : state.cashierList;
  
  // Render Top 3 Waiting Queue List
  containers.waitingListContainer.innerHTML = '';
  const top3 = currentList.slice(0, 3);
  const hiddenCount = Math.max(0, currentList.length - 3);

  if (top3.length === 0) {
    containers.waitingListContainer.innerHTML = '<div class="empty-msg">Tidak ada antrean menunggu</div>';
  } else {
    top3.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'waiting-card';
      const ticketNo = item.ticketNo || item.queueTicket?.ticketNo || '-';
      const patientName = item.patientName || item.visit?.patientName || (item.patientType ? `Pasien ${item.patientType}` : 'Pasien Umum');
      
      card.innerHTML = `
        <div class="waiting-info">
          <span class="waiting-no">#${index + 1} ${ticketNo}</span>
          <div class="waiting-meta">
            <span class="waiting-name">${patientName}</span>
          </div>
        </div>
        <button class="btn btn-xs btn-primary call-specific-btn" data-id="${item.id}">
          ▶ Panggil
        </button>
      `;
      containers.waitingListContainer.appendChild(card);
    });

    // Add click event for specific call
    containers.waitingListContainer.querySelectorAll('.call-specific-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        callTicketById(id);
      });
    });
  }

  // Render Hidden Count Indicator
  if (hiddenCount > 0) {
    containers.hiddenCountIndicator.style.display = 'block';
    texts.hiddenCountNum.innerText = hiddenCount;
  } else {
    containers.hiddenCountIndicator.style.display = 'none';
  }

  // Render Active Called Ticket Card
  renderActiveCard();
}

function renderActiveCard() {
  if (!state.activeCall) {
    texts.activeUnitBadge.innerText = state.activeTab;
    texts.activeTicketNo.innerText = '-';
    texts.activePatientName.innerText = 'Belum ada pemanggilan';
    containers.activeActions.style.display = 'none';
    containers.admisiDoctorBox.style.display = 'none';
    return;
  }

  const t = state.activeCall;
  const ticketNo = t.ticketNo || t.queueTicket?.ticketNo || 'ACTIVE';
  const patientName = t.patientName || t.visit?.patientName || `Pasien ${t.patientType || ''}`;

  texts.activeUnitBadge.innerText = state.activeTab;
  texts.activeTicketNo.innerText = ticketNo;
  texts.activePatientName.innerText = patientName;
  containers.activeActions.style.display = 'block';

  if (state.activeTab === 'ADMISSION') {
    containers.admisiDoctorBox.style.display = 'block';
    containers.quickRouteBox.style.display = 'grid';
    buttons.finishDefault.innerText = '✅ Selesai ➔ Pengkajian';
    
    // Set selected doctor if visit already has one
    if (t.visit?.selectedDoctorId || t.selectedDoctorId) {
      inputs.doctorSelect.value = t.visit?.selectedDoctorId || t.selectedDoctorId;
    }
  } else {
    containers.admisiDoctorBox.style.display = 'none';
    containers.quickRouteBox.style.display = 'none';
    buttons.finishDefault.innerText = '✅ Selesai Kasir';
  }
}

// --- CALLING & FINISHING ACTIONS ---
buttons.callNext.addEventListener('click', async () => {
  const currentList = state.activeTab === 'ADMISSION' ? state.admissionList : state.cashierList;
  if (currentList.length === 0) {
    alert("Tidak ada antrean menunggu di tab ini");
    return;
  }
  await callTicketById(currentList[0].id);
});

async function callTicketById(ticketId) {
  if (!state.selectedCounter) {
    alert("Harap pilih Loket / Counter aktif terlebih dahulu");
    return;
  }

  try {
    buttons.callNext.disabled = true;
    log(`Memanggil antrean ${state.activeTab}...`);

    const endpoint = state.activeTab === 'ADMISSION'
      ? `/admission/${ticketId}/call`
      : `/cashier/${ticketId}/call`;

    await axios.post(endpoint, { counterId: state.selectedCounter });
    await refreshQueues();
    
    log(`Berhasil memanggil antrean!`);
    ipcRenderer.send('show-window'); // Auto Pop-Up Window

  } catch (err) {
    log("Gagal memanggil: " + (err.response?.data?.message || err.message));
  } finally {
    buttons.callNext.disabled = false;
  }
}

buttons.recall.addEventListener('click', async () => {
  if (!state.activeCall) return;
  const ticketId = state.activeCall.id || state.activeCall.queueTicketId;
  
  try {
    buttons.recall.disabled = true;
    log("Memanggil ulang...");

    const endpoint = state.activeTab === 'ADMISSION'
      ? `/admission/${ticketId}/call`
      : `/cashier/${ticketId}/call`;

    await axios.post(endpoint, { counterId: state.selectedCounter });
    log("Panggilan ulang berhasil dikirim.");
    ipcRenderer.send('show-window');

  } catch (err) {
    log("Gagal panggil ulang: " + (err.response?.data?.message || err.message));
  } finally {
    buttons.recall.disabled = false;
  }
});

// Primary 1-Click Finish (Default -> Pengkajian for Admisi)
buttons.finishDefault.addEventListener('click', () => {
  finishActiveTicket('ASSESSMENT');
});

// Quick Routing Alternative Buttons
containers.quickRouteBox.querySelectorAll('.btn-route').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.target.getAttribute('data-target');
    finishActiveTicket(target);
  });
});

async function finishActiveTicket(nextUnitType = 'ASSESSMENT') {
  if (!state.activeCall) return;
  const ticketId = state.activeCall.id;

  try {
    log("Selesai memproses antrean...");

    if (state.activeTab === 'ADMISSION') {
      const selectedDoctorId = inputs.doctorSelect.value;
      if (selectedDoctorId) {
        await axios.post(`/admission/${ticketId}/update-patient-data`, {
          scheduleId: selectedDoctorId
        }).catch(() => {});
      }

      await axios.post(`/admission/${ticketId}/finish`, {
        nextUnitType
      });
      log(`Admisi selesai, pasien diarahkan ke ${nextUnitType}!`);

    } else {
      await axios.post(`/cashier/${ticketId}/finish`);
      log("Kasir selesai, pembayaran berhasil diproses!");
    }

    state.activeCall = null;
    await refreshQueues();

  } catch (err) {
    log("Gagal menyelesaikan: " + (err.response?.data?.message || err.message));
  }
}

// --- MANUAL TICKET FORM MODAL ---
buttons.openManual.addEventListener('click', () => {
  containers.manualModal.classList.add('active');
});

buttons.closeManual.addEventListener('click', () => {
  containers.manualModal.classList.remove('active');
});

document.getElementById('manualTicketForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const category = document.getElementById('manualType').value;
  const patientType = document.getElementById('manualPatientType').value;

  try {
    log("Mencetak antrean manual...");
    const res = await axios.post('/queue/kiosk/ticket', {
      category,
      patientType
    });

    const ticketNo = res.data?.ticketNo || 'OK';
    containers.manualModal.classList.remove('active');
    await refreshQueues();
    log(`Berhasil membuat antrean manual #${ticketNo}!`);

  } catch (err) {
    alert("Gagal membuat antrean: " + (err.response?.data?.message || err.message));
  }
});

// --- SOCKET.IO REALTIME ENGINE ---
function initSocket() {
  if (state.socket) return;
  
  state.socket = io(state.serverUrl, {
    transports: ['websocket', 'polling']
  });
  
  state.socket.on('connect', () => {
    log("Terhubung ke server realtime Socket.io.");
  });

  state.socket.on('disconnect', () => {
    log("Terputus dari server realtime.");
  });

  // Listen for realtime queue updates
  state.socket.on('queue-updated', () => {
    refreshQueues().then(() => {
      // Auto Pop-up when new waiting ticket arrives
      const currentList = state.activeTab === 'ADMISSION' ? state.admissionList : state.cashierList;
      if (currentList.length > 0) {
        ipcRenderer.send('show-window');
      }
    });
  });

  state.socket.on('dashboard-refresh', () => {
    refreshQueues();
  });
}

// --- ACTIVE CALL REMINDER TIMER (1 MINUTE) ---
function startReminderTimer() {
  stopReminderTimer();
  state.reminderTimer = setInterval(() => {
    if (state.activeCall) {
      log("Pengingat: Ada panggilan antrean aktif yang belum diselesaikan.");
      ipcRenderer.send('show-window'); // Auto Pop-up nudge per 1 min
    }
  }, 60000); // 60 seconds
}

function stopReminderTimer() {
  if (state.reminderTimer) {
    clearInterval(state.reminderTimer);
    state.reminderTimer = null;
  }
}
