'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';

export default function DesktopWidgetPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Selections
  const [counters, setCounters] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);

  const [selectedCounter, setSelectedCounter] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [isLocationLocked, setIsLocationLocked] = useState(false);

  // Queue State
  const [queue, setQueue] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Check stored auth
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Load locations based on role
  const loadLocations = useCallback(async () => {
    if (!user) return;
    try {
      if (['ADMISSION', 'CASHIER', 'ADMIN'].includes(user.role)) {
        const res = await api.get('/counters');
        setCounters(res.data.filter((c: any) => c.isActive));
        const saved = localStorage.getItem('widgetCounter');
        if (saved) { setSelectedCounter(saved); setIsLocationLocked(true); }
      }
      if (['DOCTOR', 'ADMIN'].includes(user.role)) {
        const res = await api.get('/rooms');
        setRooms(res.data.filter((r: any) => ['DOCTOR', 'DOCTOR_CHILD'].includes(r.roomType)));
        const saved = localStorage.getItem('widgetRoom');
        if (saved) { setSelectedRoom(saved); setIsLocationLocked(true); }
      }
      if (['ASSESSMENT', 'BDR', 'ADMIN'].includes(user.role)) {
        const res = await api.get('/floors');
        setFloors(res.data.filter((f: any) => f.floorNumber !== 1));
        const saved = localStorage.getItem('widgetFloor');
        if (saved) { setSelectedFloor(saved); setIsLocationLocked(true); }
      }
    } catch (err) {
      console.error('Failed to load locations', err);
    }
  }, [user]);

  // Load Queue
  const loadQueue = useCallback(async () => {
    if (!token || !user) return;
    try {
      let endpoint = '';
      if (user.role === 'ADMISSION') endpoint = '/admission/queue';
      else if (user.role === 'CASHIER') endpoint = '/cashier/queue';
      else if (user.role === 'DOCTOR') endpoint = selectedRoom ? `/doctor-queue/queue?roomId=${selectedRoom}` : '/doctor-queue/queue';
      else if (user.role === 'ASSESSMENT') endpoint = selectedFloor ? `/assessment/queue?floorId=${selectedFloor}` : '/assessment/queue';
      else if (user.role === 'BDR') endpoint = selectedFloor ? `/bdr/queue?floorId=${selectedFloor}` : '/bdr/queue';
      else if (user.role === 'PHARMACY') endpoint = '/pharmacy/queue';
      else endpoint = '/admission/queue';

      const res = await api.get(endpoint);
      setQueue(res.data || []);
    } catch (err) {
      console.error('Failed to load queue', err);
    }
  }, [token, user, selectedRoom, selectedFloor]);

  useEffect(() => {
    if (user) {
      loadLocations();
    }
  }, [user, loadLocations]);

  useEffect(() => {
    if (token && user) {
      loadQueue();
      const socket = getSocket();
      const handleRefresh = () => loadQueue();
      socket.on('dashboardRefresh', handleRefresh);
      socket.on('queueUpdate', handleRefresh);

      const interval = setInterval(loadQueue, 4000);
      return () => {
        clearInterval(interval);
        socket.off('dashboardRefresh', handleRefresh);
        socket.off('queueUpdate', handleRefresh);
      };
    }
  }, [token, user, loadQueue]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: loginEmail, password: loginPassword });
      const { access_token, user: u } = res.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(u));
      setToken(access_token);
      setUser(u);
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setIsLocationLocked(false);
  };

  const saveLocation = () => {
    if (['ADMISSION', 'CASHIER'].includes(user?.role) && selectedCounter) {
      localStorage.setItem('widgetCounter', selectedCounter);
    }
    if (user?.role === 'DOCTOR' && selectedRoom) {
      localStorage.setItem('widgetRoom', selectedRoom);
    }
    if (['ASSESSMENT', 'BDR'].includes(user?.role) && selectedFloor) {
      localStorage.setItem('widgetFloor', selectedFloor);
    }
    setIsLocationLocked(true);
  };

  // Actions
  const callPatient = async (visitIdOrTicketId: string) => {
    setActionLoading(visitIdOrTicketId);
    try {
      if (user.role === 'ADMISSION') await api.post(`/admission/${visitIdOrTicketId}/call`, { counterId: selectedCounter });
      else if (user.role === 'CASHIER') await api.post(`/cashier/${visitIdOrTicketId}/call`, { counterId: selectedCounter });
      else if (user.role === 'DOCTOR') await api.post(`/doctor-queue/${visitIdOrTicketId}/call`);
      else if (user.role === 'ASSESSMENT') await api.post(`/assessment/${visitIdOrTicketId}/start`);
      else if (user.role === 'BDR') await api.post(`/bdr/${visitIdOrTicketId}/call`);
      else if (user.role === 'PHARMACY') await api.post(`/pharmacy/${visitIdOrTicketId}/call`);
      await loadQueue();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memanggil');
    } finally {
      setActionLoading(null);
    }
  };

  const startService = async (visitId: string) => {
    setActionLoading(visitId);
    try {
      if (user.role === 'DOCTOR') await api.post(`/doctor-queue/${visitId}/start`);
      else if (user.role === 'BDR') await api.post(`/bdr/${visitId}/start`);
      await loadQueue();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memulai');
    } finally {
      setActionLoading(null);
    }
  };

  const finishService = async (visitIdOrTicketId: string) => {
    setActionLoading(visitIdOrTicketId);
    try {
      if (user.role === 'ADMISSION') await api.post(`/admission/${visitIdOrTicketId}/finish`, { nextUnitType: 'ASSESSMENT' });
      else if (user.role === 'CASHIER') await api.post(`/cashier/${visitIdOrTicketId}/finish`);
      else if (user.role === 'DOCTOR') await api.post(`/doctor-queue/${visitIdOrTicketId}/finish`);
      else if (user.role === 'ASSESSMENT') await api.post(`/assessment/${visitIdOrTicketId}/finish`, { nextUnitType: 'DOCTOR' });
      else if (user.role === 'BDR') await api.post(`/bdr/${visitIdOrTicketId}/finish`, { nextUnitType: 'DOCTOR' });
      else if (user.role === 'PHARMACY') await api.post(`/pharmacy/${visitIdOrTicketId}/finish`);
      await loadQueue();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyelesaikan');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter queues
  const waitingList = queue.filter((item: any) => {
    const s = item.journeySessions?.[0] || item.visit?.journeySessions?.[0];
    return item.status === 'WAITING' || s?.status === 'WAITING' || s?.status === 'SKIPPED';
  });

  const activeItem = queue.find((item: any) => {
    const s = item.journeySessions?.[0] || item.visit?.journeySessions?.[0];
    return s && ['CALLED', 'SERVING'].includes(s.status);
  });

  if (!token || !user) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>🔔 Orbita Caller Widget</span>
        </div>
        <div style={styles.card}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: '#1e3a8a' }}>Login Operator</h3>
          {loginError && <div style={styles.error}>{loginError}</div>}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="email"
              placeholder="Email Operator"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              style={styles.input}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              style={styles.input}
              required
            />
            <button type="submit" disabled={loading} style={styles.primaryBtn}>
              {loading ? 'Logging in...' : '🔑 Login Widget'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <div style={styles.header}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e3a8a' }}>{user.name}</span>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Role: {user.role}</span>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>

      {/* Location Selector */}
      {!isLocationLocked && (
        <div style={styles.locationCard}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>📍 Pilih Lokasi Bertugas:</div>
          {['ADMISSION', 'CASHIER'].includes(user.role) && (
            <select value={selectedCounter} onChange={(e) => setSelectedCounter(e.target.value)} style={styles.input}>
              <option value="">-- Pilih Counter --</option>
              {counters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {user.role === 'DOCTOR' && (
            <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} style={styles.input}>
              <option value="">-- Pilih Ruangan / Poli --</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          )}
          {['ASSESSMENT', 'BDR'].includes(user.role) && (
            <select value={selectedFloor} onChange={(e) => setSelectedFloor(e.target.value)} style={styles.input}>
              <option value="">-- Pilih Lantai --</option>
              {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          <button onClick={saveLocation} style={{ ...styles.primaryBtn, marginTop: '8px' }}>💾 Lock Sesi Widget</button>
        </div>
      )}

      {isLocationLocked && (
        <div style={styles.activeLocationBar}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#047857' }}>
            📍 {selectedCounter ? counters.find(c => c.id === selectedCounter)?.name : selectedRoom ? rooms.find(r => r.id === selectedRoom)?.name : selectedFloor ? floors.find(f => f.id === selectedFloor)?.name : 'Aktif'}
          </span>
          <button onClick={() => setIsLocationLocked(false)} style={styles.switchBtn}>🔄 Ganti</button>
        </div>
      )}

      {/* Active Call Card */}
      <div style={styles.activeCard}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', letterSpacing: '0.5px' }}>PASIEN AKTIF / DIPANGGIL</div>
        {activeItem ? (
          <div style={{ margin: '8px 0' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
              {activeItem.patientName || activeItem.doctorTicketNo || activeItem.ticketNo || activeItem.queueTicket?.ticketNo || 'Pasien'}
            </div>
            {activeItem.doctorTicketNo && <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Tiket: {activeItem.doctorTicketNo}</div>}
            <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
              <button
                onClick={() => callPatient(activeItem.id)}
                disabled={actionLoading === activeItem.id}
                style={{ ...styles.secondaryBtn, flex: 1 }}
              >
                🔄 Ulang
              </button>
              <button
                onClick={() => finishService(activeItem.id)}
                disabled={actionLoading === activeItem.id}
                style={{ ...styles.successBtn, flex: 1 }}
              >
                ✅ Selesai
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 0', color: '#94a3b8', fontSize: '0.85rem' }}>Belum ada antrean dipanggil</div>
        )}
      </div>

      {/* Waiting List Quick Call */}
      <div style={styles.waitingSection}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⏳ Menunggu ({waitingList.length})</span>
        </div>
        {waitingList.length === 0 ? (
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>Tidak ada antrean menunggu</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            {waitingList.map((item: any) => {
              const ticketId = item.id;
              const name = item.patientName || item.doctorTicketNo || item.ticketNo || item.queueTicket?.ticketNo || 'Pasien';
              return (
                <div key={item.id} style={styles.waitingItem}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{name}</span>
                  <button
                    onClick={() => callPatient(ticketId)}
                    disabled={actionLoading === ticketId}
                    style={styles.callBtn}
                  >
                    📢 Panggil
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    minHeight: '100vh',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#ffffff',
    padding: '8px 12px',
    borderRadius: '10px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#1e3a8a',
  },
  card: {
    background: '#ffffff',
    padding: '14px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  },
  locationCard: {
    background: '#ffffff',
    padding: '10px',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  activeLocationBar: {
    background: '#ecfdf5',
    border: '1px solid #10b981',
    padding: '6px 10px',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeCard: {
    background: '#ffffff',
    borderLeft: '4px solid #2563eb',
    padding: '12px',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(37,99,235,0.08)',
  },
  waitingSection: {
    background: '#ffffff',
    padding: '10px',
    borderRadius: '10px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  waitingItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 8px',
    background: '#f8fafc',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.85rem',
    boxSizing: 'border-box',
  },
  primaryBtn: {
    width: '100%',
    padding: '8px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 700,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '6px 10px',
    background: '#f59e0b',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  successBtn: {
    padding: '6px 10px',
    background: '#10b981',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  callBtn: {
    padding: '4px 10px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    fontWeight: 600,
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  switchBtn: {
    padding: '3px 8px',
    background: '#f59e0b',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  logoutBtn: {
    padding: '4px 8px',
    background: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    fontSize: '0.7rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    padding: '6px 8px',
    background: '#fef2f2',
    color: '#ef4444',
    borderRadius: '6px',
    fontSize: '0.75rem',
    marginBottom: '8px',
  },
};
