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
  counterStatus: 'STANDBY', // 'STANDBY' | 'BUSY'
  doctors: [],
  schedules: [],
  selectedCounter: localStorage.getItem('orbita_selected_counter') || null,
  activeTab: 'ADMISSION', // 'ADMISSION' | 'CASHIER'
  admissionList: [],
  cashierList: [],
  cashierSyncList: [],
  activeCall: null, // Currently serving/called ticket
  isAlwaysOnTop: true,
  reminderTimer: null,

  // Active Modals Data State
  targetCancelTicket: null,
  targetTransferTicket: null,
  targetSyncTicketId: null,
  targetPatientTicket: null,
  targetTimeTicket: null,
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
  modalCounterSelect: document.getElementById('modalCounterSelect'),
  doctorSelect: document.getElementById('doctorSelect'),
  patientScheduleSelect: document.getElementById('patientScheduleSelect'),
  patientDoctorTicketNo: document.getElementById('patientDoctorTicketNo'),
  patientRmNoInput: document.getElementById('patientRmNoInput'),
  patientNameInput: document.getElementById('patientNameInput'),
  cancelReasonInput: document.getElementById('cancelReasonInput'),
  transferTargetSelect: document.getElementById('transferTargetSelect'),
  transferReasonInput: document.getElementById('transferReasonInput'),
  syncTargetVisitSelect: document.getElementById('syncTargetVisitSelect'),
  timeFieldSelect: document.getElementById('timeFieldSelect'),
  timeCorrectedInput: document.getElementById('timeCorrectedInput'),
  timeReasonInput: document.getElementById('timeReasonInput')
};

const texts = {
  loginError: document.getElementById('loginError'),
  userName: document.getElementById('userName'),
  userRole: document.getElementById('userRole'),
  currentCounterName: document.getElementById('currentCounterName'),
  counterStatusBadge: document.getElementById('counterStatusBadge'),
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
  toggleCounterStatus: document.getElementById('toggleCounterStatusBtn'),
  changeCounter: document.getElementById('changeCounterBtn'),
  saveCounter: document.getElementById('saveCounterBtn'),
  closeCounterModal: document.getElementById('closeCounterModalBtn'),
  tabAdmisi: document.getElementById('tabAdmisi'),
  tabKasir: document.getElementById('tabKasir'),
  callNext: document.getElementById('callNextBtn'),
  recall: document.getElementById('recallBtn'),
  finishDefault: document.getElementById('finishDefaultBtn'),
  openManual: document.getElementById('openManualBtn'),
  closeManual: document.getElementById('closeManualBtn'),
  editPatient: document.getElementById('editPatientBtn'),
  correctTime: document.getElementById('correctTimeBtn'),
  holdActive: document.getElementById('holdActiveBtn'),
  transferActive: document.getElementById('transferActiveBtn'),
  cancelActive: document.getElementById('cancelActiveBtn'),
  closePatientModal: document.getElementById('closePatientModalBtn'),
  closeCancelModal: document.getElementById('closeCancelModalBtn'),
  closeTransferModal: document.getElementById('closeTransferModalBtn'),
  closeSyncModal: document.getElementById('closeSyncModalBtn'),
  closeTimeModal: document.getElementById('closeTimeModalBtn'),
  minBtn: document.getElementById('minBtn'),
  closeBtn: document.getElementById('closeBtn'),
  alwaysOnTopBtn: document.getElementById('alwaysOnTopBtn')
};

const containers = {
  activeActions: document.getElementById('activeActions'),
  admisiDoctorBox: document.getElementById('admisiDoctorBox'),
  quickRouteBox: document.getElementById('quickRouteBox'),
  activeMiniTools: document.getElementById('activeMiniTools'),
  waitingListContainer: document.getElementById('waitingListContainer'),
  hiddenCountIndicator: document.getElementById('hiddenCountIndicator'),
  counterModal: document.getElementById('counterModal'),
  patientModal: document.getElementById('patientModal'),
  cancelModal: document.getElementById('cancelModal'),
  transferModal: document.getElementById('transferModal'),
  syncModal: document.getElementById('syncModal'),
  timeModal: document.getElementById('timeModal'),
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
buttons.minBtn.addEventListener('click', () => ipcRenderer.send('minimize-window'));
buttons.closeBtn.addEventListener('click', () => ipcRenderer.send('close-window'));

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
  await loadSchedules();
  await refreshQueues();
  initSocket();
  startReminderTimer();
}

// --- COUNTER MANAGEMENT (MATCHING WEB FRONT-DESK) ---
async function loadCounters() {
  try {
    const res = await axios.get('/counters');
    state.counters = res.data.filter(c => (c.canHandleAdmission || c.canHandleCashier) && c.isActive);
    
    inputs.modalCounterSelect.innerHTML = '';
    state.counters.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.innerText = c.name;
      inputs.modalCounterSelect.appendChild(opt);
    });

    if (state.selectedCounter && state.counters.some(c => c.id === state.selectedCounter)) {
      inputs.modalCounterSelect.value = state.selectedCounter;
      updateCounterUI();
      await fetchCounterStatus(state.selectedCounter);
    } else {
      containers.counterModal.classList.add('active'); // Prompt to pick counter
    }
  } catch (err) {
    log("Gagal memuat counter: " + err.message);
  }
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
  texts.currentCounterName.innerText = current ? current.name : '-';
}

function updateCounterStatusUI() {
  if (state.counterStatus === 'BUSY') {
    texts.counterStatusBadge.innerText = 'SEDANG MELAYANI';
    texts.counterStatusBadge.className = 'badge badge-busy';
    buttons.toggleCounterStatus.innerText = '🟢 Set Standby';
    buttons.toggleCounterStatus.className = 'btn btn-xs btn-success';
  } else {
    texts.counterStatusBadge.innerText = 'STANDBY';
    texts.counterStatusBadge.className = 'badge badge-standby';
    buttons.toggleCounterStatus.innerText = '🔴 Set Sibuk';
    buttons.toggleCounterStatus.className = 'btn btn-xs btn-danger';
  }
}

buttons.toggleCounterStatus.addEventListener('click', async () => {
  if (!state.selectedCounter) return;
  const newStatus = state.counterStatus === 'BUSY' ? 'STANDBY' : 'BUSY';
  try {
    await axios.put(`/counters/${state.selectedCounter}/status`, { status: newStatus });
    state.counterStatus = newStatus;
    updateCounterStatusUI();
    log(`Status loket diubah menjadi ${newStatus}`);
  } catch (err) {
    alert(err.response?.data?.message || 'Gagal mengubah status counter');
  }
});

buttons.changeCounter.addEventListener('click', () => {
  containers.counterModal.classList.add('active');
});

buttons.closeCounterModal.addEventListener('click', () => {
  containers.counterModal.classList.remove('active');
});

buttons.saveCounter.addEventListener('click', () => {
  const val = inputs.modalCounterSelect.value;
  if (!val) return alert("Pilih counter terlebih dahulu");
  state.selectedCounter = val;
  localStorage.setItem('orbita_selected_counter', val);
  updateCounterUI();
  fetchCounterStatus(val);
  containers.counterModal.classList.remove('active');
  log(`Loket aktif diubah ke ${texts.currentCounterName.innerText}`);
});

// --- DOCTORS & SCHEDULES ---
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
  } catch (err) {}
}

async function loadSchedules() {
  try {
    const res = await axios.get('/schedules/active-today');
    state.schedules = Array.isArray(res.data) ? res.data : [];
    inputs.patientScheduleSelect.innerHTML = '<option value="">-- Pilih Dokter Tujuan --</option>';
    state.schedules.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.innerText = `${s.doctor?.doctorName || 'Dokter'} - Poli ${s.room?.name || ''}`;
      inputs.patientScheduleSelect.appendChild(opt);
    });
  } catch (err) {}
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

    // Filter waiting
    state.admissionList = admData.filter(t => {
      const session = t.visit?.journeySessions?.[0];
      return t.status === 'WAITING' || (t.status === 'IN_PROGRESS' && session?.status === 'SKIPPED');
    });

    const isCashierTicket = (v) => {
      const ticketNo = v.queueTicket?.ticketNo || v.doctorTicketNo || '';
      return ticketNo.startsWith('G') || ticketNo.startsWith('H');
    };

    const allCashWaiting = kasData.filter(v => {
      const s = v.journeySessions?.[0];
      return s?.status === 'WAITING' || s?.status === 'SKIPPED';
    });

    state.cashierList = allCashWaiting.filter(isCashierTicket);
    state.cashierSyncList = allCashWaiting.filter(v => !isCashierTicket(v) && v.patientName);

    // Active calls
    const activeAdm = admData.find(t => {
      const s = t.visit?.journeySessions?.[0];
      return t.status === 'IN_PROGRESS' && s && ['CALLED', 'SERVING'].includes(s.status);
    });

    const activeKas = kasData.find(v => ['CALLED', 'SERVING'].includes(v.journeySessions?.[0]?.status));

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
  
  // Render Top 3 Waiting List Cards
  containers.waitingListContainer.innerHTML = '';
  const top3 = currentList.slice(0, 3);
  const hiddenCount = Math.max(0, currentList.length - 3);

  if (top3.length === 0) {
    containers.waitingListContainer.innerHTML = '<div class="empty-msg">Tidak ada antrean menunggu</div>';
  } else {
    top3.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'waiting-card';
      
      const ticketNo = item.ticketNo || item.doctorTicketNo || item.queueTicket?.ticketNo || '-';
      const patientName = item.patientName || item.visit?.patientName || (item.patientType ? `Pasien ${item.patientType}` : 'Pasien');
      const isHold = item.visit?.journeySessions?.[0]?.status === 'SKIPPED' || item.journeySessions?.[0]?.status === 'SKIPPED';

      card.innerHTML = `
        <div class="waiting-info">
          <span class="waiting-no">#${index + 1} ${ticketNo}</span>
          <div class="waiting-meta">
            <span class="waiting-name">${patientName}</span>
            ${isHold ? '<span class="badge" style="background:#f59e0b;color:#fff;font-size:8px;">HOLD</span>' : ''}
          </div>
        </div>
        <div class="waiting-card-actions">
          <button class="btn btn-xs btn-primary call-specific-btn" data-id="${item.id}" title="Panggil">
            ▶ Panggil
          </button>
          ${state.activeTab === 'CASHIER' ? `
            <button class="btn btn-xs btn-outline sync-btn" data-id="${item.id}" title="Sync Tiket">🔗</button>
          ` : ''}
          <button class="btn btn-xs btn-outline hold-btn" data-id="${item.id}" title="Hold/Pause">⏸️</button>
          <button class="btn btn-xs btn-danger cancel-btn" data-id="${item.id}" title="Batal/Drop">❌</button>
        </div>
      `;
      containers.waitingListContainer.appendChild(card);
    });

    // Attach card event listeners
    containers.waitingListContainer.querySelectorAll('.call-specific-btn').forEach(b => {
      b.addEventListener('click', e => callTicketById(e.target.getAttribute('data-id')));
    });

    containers.waitingListContainer.querySelectorAll('.hold-btn').forEach(b => {
      b.addEventListener('click', e => holdAction(e.target.getAttribute('data-id')));
    });

    containers.waitingListContainer.querySelectorAll('.cancel-btn').forEach(b => {
      b.addEventListener('click', e => {
        const id = e.target.getAttribute('data-id');
        const item = currentList.find(i => i.id === id);
        openCancelModal(item);
      });
    });

    containers.waitingListContainer.querySelectorAll('.sync-btn').forEach(b => {
      b.addEventListener('click', e => {
        const id = e.target.getAttribute('data-id');
        openSyncModal(id);
      });
    });
  }

  // Hidden Indicator
  if (hiddenCount > 0) {
    containers.hiddenCountIndicator.style.display = 'block';
    texts.hiddenCountNum.innerText = hiddenCount;
  } else {
    containers.hiddenCountIndicator.style.display = 'none';
  }

  renderActiveCard();
}

function renderActiveCard() {
  if (!state.activeCall) {
    texts.activeUnitBadge.innerText = state.activeTab;
    texts.activeTicketNo.innerText = '-';
    texts.activePatientName.innerText = 'Belum ada pemanggilan';
    containers.activeActions.style.display = 'none';
    containers.activeMiniTools.style.display = 'none';
    containers.admisiDoctorBox.style.display = 'none';
    return;
  }

  const t = state.activeCall;
  const ticketNo = t.ticketNo || t.doctorTicketNo || t.queueTicket?.ticketNo || 'ACTIVE';
  const patientName = t.patientName || t.visit?.patientName || `Pasien ${t.patientType || ''}`;

  texts.activeUnitBadge.innerText = state.activeTab;
  texts.activeTicketNo.innerText = ticketNo;
  texts.activePatientName.innerText = patientName;

  containers.activeActions.style.display = 'block';
  containers.activeMiniTools.style.display = 'flex';

  if (state.activeTab === 'ADMISSION') {
    containers.admisiDoctorBox.style.display = 'block';
    containers.quickRouteBox.style.display = 'grid';
    buttons.finishDefault.innerText = '✅ Selesai ➔ Pengkajian';
    
    if (t.visit?.selectedDoctorId || t.selectedDoctorId) {
      inputs.doctorSelect.value = t.visit?.selectedDoctorId || t.selectedDoctorId;
    }
  } else {
    containers.admisiDoctorBox.style.display = 'none';
    containers.quickRouteBox.style.display = 'none';
    buttons.finishDefault.innerText = '✅ Selesai Kasir';
  }
}

// --- CALLING & ACTIONS ---
buttons.callNext.addEventListener('click', async () => {
  const currentList = state.activeTab === 'ADMISSION' ? state.admissionList : state.cashierList;
  if (currentList.length === 0) return alert("Tidak ada antrean menunggu di tab ini");
  await callTicketById(currentList[0].id);
});

async function callTicketById(ticketId) {
  if (!state.selectedCounter) return alert("Harap pilih Loket / Counter aktif terlebih dahulu");

  try {
    buttons.callNext.disabled = true;
    log(`Memanggil antrean ${state.activeTab}...`);

    const endpoint = state.activeTab === 'ADMISSION'
      ? `/admission/${ticketId}/call`
      : `/cashier/${ticketId}/call`;

    await axios.post(endpoint, { counterId: state.selectedCounter });
    await refreshQueues();
    
    log(`Berhasil memanggil antrean!`);
    ipcRenderer.send('show-window'); // Auto Pop-Up

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

// Primary 1-Click Finish
buttons.finishDefault.addEventListener('click', () => {
  finishActiveTicket('ASSESSMENT');
});

// Quick Routing Buttons
containers.quickRouteBox.querySelectorAll('.btn-route').forEach(btn => {
  btn.addEventListener('click', (e) => {
    finishActiveTicket(e.target.getAttribute('data-target'));
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
        await axios.put(`/admission/${ticketId}/patient-data`, {
          scheduleId: selectedDoctorId
        }).catch(() => {});
      }

      await axios.post(`/admission/${ticketId}/finish`, { nextUnitType });
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

// --- HOLD ACTION ---
async function holdAction(ticketId) {
  if (!ticketId) return;
  try {
    log("Me-hold antrean...");
    const prefix = state.activeTab === 'ADMISSION' ? 'admission' : 'cashier';
    await axios.post(`/${prefix}/${ticketId}/hold`);
    await refreshQueues();
    log("Antrean berhasil di-hold!");
  } catch (err) {
    alert(err.response?.data?.message || "Gagal me-hold antrean");
  }
}

buttons.holdActive.addEventListener('click', () => {
  if (state.activeCall) holdAction(state.activeCall.id);
});

// --- CANCEL / DROP ACTION ---
function openCancelModal(ticket) {
  state.targetCancelTicket = ticket;
  inputs.cancelReasonInput.value = '';
  containers.cancelModal.classList.add('active');
}

buttons.cancelActive.addEventListener('click', () => {
  if (state.activeCall) openCancelModal(state.activeCall);
});

buttons.closeCancelModal.addEventListener('click', () => {
  containers.cancelModal.classList.remove('active');
});

document.getElementById('cancelForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.targetCancelTicket) return;
  const reason = inputs.cancelReasonInput.value.trim();
  if (!reason) return alert("Masukkan alasan pembatalan");

  try {
    log("Membatalkan antrean...");
    const prefix = state.activeTab === 'ADMISSION' ? 'admission' : 'cashier';
    await axios.post(`/${prefix}/${state.targetCancelTicket.id}/cancel`, { reason });
    containers.cancelModal.classList.remove('active');
    state.targetCancelTicket = null;
    state.activeCall = null;
    await refreshQueues();
    log("Antrean berhasil dibatalkan!");
  } catch (err) {
    alert(err.response?.data?.message || "Gagal membatalkan antrean");
  }
});

// --- TRANSFER ACTION ---
buttons.transferActive.addEventListener('click', () => {
  if (!state.activeCall) return;
  state.targetTransferTicket = state.activeCall;
  inputs.transferReasonInput.value = '';
  containers.transferModal.classList.add('active');
});

buttons.closeTransferModal.addEventListener('click', () => {
  containers.transferModal.classList.remove('active');
});

document.getElementById('transferForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.targetTransferTicket) return;
  const targetUnitType = inputs.transferTargetSelect.value;
  const reason = inputs.transferReasonInput.value.trim();
  if (!reason) return alert("Masukkan alasan transfer");

  try {
    log("Mentransfer pasien...");
    const prefix = state.activeTab === 'ADMISSION' ? 'admission' : 'cashier';
    await axios.post(`/${prefix}/${state.targetTransferTicket.id}/transfer`, {
      targetUnitType,
      reason
    });
    containers.transferModal.classList.remove('active');
    state.targetTransferTicket = null;
    state.activeCall = null;
    await refreshQueues();
    log(`Pasien berhasil ditransfer ke ${targetUnitType}!`);
  } catch (err) {
    alert(err.response?.data?.message || "Gagal mentransfer pasien");
  }
});

// --- SYNC ACTION (KASIR) ---
function openSyncModal(ticketId) {
  state.targetSyncTicketId = ticketId;
  inputs.syncTargetVisitSelect.innerHTML = '<option value="">-- Pilih Data Pasien --</option>';
  
  state.cashierSyncList.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.innerText = `${w.doctorTicketNo || w.queueTicket?.ticketNo || '-'} - ${w.patientName}`;
    inputs.syncTargetVisitSelect.appendChild(opt);
  });

  containers.syncModal.classList.add('active');
}

buttons.closeSyncModal.addEventListener('click', () => {
  containers.syncModal.classList.remove('active');
});

document.getElementById('syncForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.targetSyncTicketId) return;
  const targetVisitId = inputs.syncTargetVisitSelect.value;
  if (!targetVisitId) return alert("Pilih data pasien yang ingin digabungkan");

  try {
    log("Menggabungkan antrean kasir...");
    await axios.post(`/cashier/${state.targetSyncTicketId}/sync`, { targetVisitId });
    containers.syncModal.classList.remove('active');
    state.targetSyncTicketId = null;
    await refreshQueues();
    log("Berhasil menggabungkan antrean kasir!");
  } catch (err) {
    alert(err.response?.data?.message || "Gagal menggabungkan antrean");
  }
});

// --- EDIT PATIENT DATA ACTION ---
buttons.editPatient.addEventListener('click', () => {
  if (!state.activeCall) return;
  state.targetPatientTicket = state.activeCall;
  const v = state.activeCall.visit || state.activeCall;
  
  inputs.patientRmNoInput.value = v.patientRmNo || '';
  inputs.patientNameInput.value = v.patientName || '';
  inputs.patientScheduleSelect.value = v.selectedScheduleId || state.activeCall.selectedScheduleId || '';
  inputs.patientDoctorTicketNo.value = v.doctorTicketNo || '';

  containers.patientModal.classList.add('active');
});

buttons.closePatientModal.addEventListener('click', () => {
  containers.patientModal.classList.remove('active');
});

document.getElementById('patientForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.targetPatientTicket) return;

  try {
    log("Menyimpan data pasien...");
    await axios.put(`/admission/${state.targetPatientTicket.id}/patient-data`, {
      patientRmNo: inputs.patientRmNoInput.value.trim(),
      patientName: inputs.patientNameInput.value.trim(),
      scheduleId: inputs.patientScheduleSelect.value,
      doctorTicketNo: inputs.patientDoctorTicketNo.value.trim()
    });
    containers.patientModal.classList.remove('active');
    await refreshQueues();
    log("Data pasien & dokter berhasil disimpan!");
  } catch (err) {
    alert(err.response?.data?.message || "Gagal menyimpan data pasien");
  }
});

// --- TIME CORRECTION ACTION ---
buttons.correctTime.addEventListener('click', () => {
  if (!state.activeCall) return;
  state.targetTimeTicket = state.activeCall;
  inputs.timeReasonInput.value = '';
  
  const now = new Date();
  const isoStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  inputs.timeCorrectedInput.value = isoStr;

  containers.timeModal.classList.add('active');
});

buttons.closeTimeModal.addEventListener('click', () => {
  containers.timeModal.classList.remove('active');
});

document.getElementById('timeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.targetTimeTicket) return;

  try {
    log("Mengoreksi waktu jam...");
    await axios.post(`/admission/${state.targetTimeTicket.id}/correct-time`, {
      field: inputs.timeFieldSelect.value,
      correctedTime: inputs.timeCorrectedInput.value,
      reason: inputs.timeReasonInput.value.trim()
    });
    containers.timeModal.classList.remove('active');
    await refreshQueues();
    log("Waktu jam berhasil dikoreksi!");
  } catch (err) {
    alert(err.response?.data?.message || "Gagal mengoreksi waktu");
  }
});

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

  state.socket.on('queue-updated', () => {
    refreshQueues().then(() => {
      const currentList = state.activeTab === 'ADMISSION' ? state.admissionList : state.cashierList;
      if (currentList.length > 0) {
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

// --- ACTIVE CALL REMINDER TIMER (1 MINUTE) ---
function startReminderTimer() {
  stopReminderTimer();
  state.reminderTimer = setInterval(() => {
    if (state.activeCall) {
      log("Pengingat: Ada panggilan antrean aktif yang belum diselesaikan.");
      ipcRenderer.send('show-window');
    }
  }, 60000);
}

function stopReminderTimer() {
  if (state.reminderTimer) {
    clearInterval(state.reminderTimer);
    state.reminderTimer = null;
  }
}
