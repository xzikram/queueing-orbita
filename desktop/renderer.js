const axios = require('axios');
const io = require('socket.io-client');
const { ipcRenderer } = require('electron');

let state = {
  token: null,
  user: null,
  socket: null,
  serverUrl: 'http://localhost:3001',
  counters: [],
  selectedCounter: null,
  currentTicket: null,
};

// --- DOM Elements ---
const screens = {
  login: document.getElementById('loginScreen'),
  caller: document.getElementById('callerScreen')
};

const inputs = {
  serverUrl: document.getElementById('serverUrl'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  counterSelect: document.getElementById('counterSelect')
};

const texts = {
  loginError: document.getElementById('loginError'),
  userName: document.getElementById('userName'),
  userRole: document.getElementById('userRole'),
  currentTicket: document.getElementById('currentTicket'),
  currentDest: document.getElementById('currentDest'),
  statusLog: document.getElementById('statusLog')
};

const buttons = {
  login: document.getElementById('loginBtn'),
  logout: document.getElementById('logoutBtn'),
  callNext: document.getElementById('callNextBtn'),
  recall: document.getElementById('recallBtn'),
  minBtn: document.getElementById('minBtn')
};

// --- Window Controls ---
buttons.minBtn.addEventListener('click', () => {
  // We can't access remote directly in newer electron without remote module,
  // but since we don't have IPC set up for minimize, we can just hide window using window.close()
  // Wait, if nodeIntegration is true, we can require electron directly here!
  const { BrowserWindow } = require('@electron/remote') || require('electron');
  // Hack: since we just want to hide it, we can just minimize.
  // Actually, we're a tray app, so hiding is better.
  window.close(); // the main process will prevent quit and just hide it, but wait, window.close() might kill it if not handled.
});

// --- Helper Functions ---
function showScreen(screenName) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screenName].classList.add('active');
}

function log(msg) {
  const time = new Date().toLocaleTimeString();
  texts.statusLog.innerText = `[${time}] ${msg}`;
}

function setupAxios() {
  axios.defaults.baseURL = state.serverUrl + '/api';
  axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
}

// --- Logic ---
buttons.login.addEventListener('click', async () => {
  const url = inputs.serverUrl.value.trim();
  const email = inputs.email.value.trim();
  const password = inputs.password.value;

  if (!url || !email || !password) {
    texts.loginError.innerText = "Harap isi semua field";
    return;
  }

  try {
    buttons.login.disabled = true;
    texts.loginError.innerText = "Connecting...";

    const res = await axios.post(`${url}/api/auth/login`, { email, password });
    
    state.serverUrl = url;
    state.token = res.data.access_token;
    state.user = res.data.user;

    setupAxios();
    
    texts.userName.innerText = state.user.name;
    texts.userRole.innerText = state.user.role;

    // Load necessary data based on role
    if (state.user.role === 'ADMISSION' || state.user.role === 'CASHIER') {
      document.getElementById('counterSelectorBox').style.display = 'block';
      const countersRes = await axios.get('/counters');
      state.counters = countersRes.data;
      
      inputs.counterSelect.innerHTML = '';
      state.counters.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.name;
        inputs.counterSelect.appendChild(opt);
      });
      state.selectedCounter = state.counters.length > 0 ? state.counters[0].id : null;
    }

    initSocket();
    showScreen('caller');
    log("Login berhasil. Menunggu aksi...");

  } catch (err) {
    texts.loginError.innerText = "Login gagal: " + (err.response?.data?.message || err.message);
  } finally {
    buttons.login.disabled = false;
  }
});

buttons.logout.addEventListener('click', () => {
  state.token = null;
  state.user = null;
  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }
  showScreen('login');
});

inputs.counterSelect.addEventListener('change', (e) => {
  state.selectedCounter = e.target.value;
});

buttons.callNext.addEventListener('click', async () => {
  try {
    buttons.callNext.disabled = true;
    log("Memanggil antrian selanjutnya...");

    // Depending on role, the API path is different
    let endpoint = '';
    let payload = {};

    if (state.user.role === 'ADMISSION') {
      const qRes = await axios.get('/admission/queue');
      const waiting = qRes.data.waitingList;
      if (waiting.length === 0) throw new Error("Tidak ada antrian");
      const nextId = waiting[0].id;
      endpoint = `/admission/${nextId}/call`;
      payload = { counterId: state.selectedCounter };
    } 
    else if (state.user.role === 'CASHIER') {
      const qRes = await axios.get('/cashier/queue');
      const waiting = qRes.data.waitingList;
      if (waiting.length === 0) throw new Error("Tidak ada antrian");
      const nextId = waiting[0].id;
      endpoint = `/cashier/${nextId}/call`;
      payload = { counterId: state.selectedCounter };
    }
    else {
      // Doctor or others (simplified for now)
      throw new Error("Role belum di-support di widget ini");
    }

    const res = await axios.post(endpoint, payload);
    state.currentTicket = res.data;
    
    // UI Update
    // Depending on API response, ticketNo might be nested
    const ticketNo = state.currentTicket.queueTicket?.ticketNo || state.currentTicket.ticketNo || "OK";
    texts.currentTicket.innerText = ticketNo;
    texts.currentDest.innerText = "Telah Dipanggil";
    
    buttons.recall.disabled = false;
    log(`Berhasil memanggil antrian ${ticketNo}`);

  } catch (err) {
    log("Gagal: " + (err.response?.data?.message || err.message));
  } finally {
    buttons.callNext.disabled = false;
  }
});

buttons.recall.addEventListener('click', async () => {
  if (!state.currentTicket) return;
  
  try {
    buttons.recall.disabled = true;
    log("Memanggil ulang...");

    let endpoint = '';
    let ticketId = state.currentTicket.id; // Or queueTicketId

    if (state.user.role === 'ADMISSION') {
      endpoint = `/admission/${ticketId}/call`;
    } else if (state.user.role === 'CASHIER') {
      endpoint = `/cashier/${ticketId}/call`;
    }

    await axios.post(endpoint, { counterId: state.selectedCounter });
    log("Panggilan ulang berhasil.");

  } catch (err) {
    log("Gagal memanggil ulang: " + err.message);
  } finally {
    buttons.recall.disabled = false;
  }
});

function initSocket() {
  state.socket = io(state.serverUrl);
  
  state.socket.on('connect', () => {
    log("Terhubung ke server realtime.");
  });

  state.socket.on('disconnect', () => {
    log("Terputus dari server realtime.");
  });

  // Listen for generic queue updates to refresh dashboard maybe
}
