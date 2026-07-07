'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import styles from './admission.module.css';

interface Destination {
  unitType: string;
  label: string;
  icon: string;
  isDefault: boolean;
}

export default function AdmissionPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [selectedCounter, setSelectedCounter] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [counterStatus, setCounterStatus] = useState('STANDBY');
  const [tempCounter, setTempCounter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Patient data modal
  const [patientModal, setPatientModal] = useState<any>(null);
  const [patientForm, setPatientForm] = useState({ patientRmNo: '', patientName: '', scheduleId: '', doctorTicketNo: '' });
  const [completingTicket, setCompletingTicket] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  // Time correction modal
  const [timeModal, setTimeModal] = useState<any>(null);
  const [timeForm, setTimeForm] = useState({ field: 'calledAt', correctedTime: '', reason: '' });
  // Destination modal (for finish service)
  const [destModal, setDestModal] = useState<any>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  // Transfer modal
  const [transferModal, setTransferModal] = useState<any>(null);
  const [transferReason, setTransferReason] = useState('');
  const [allDestinations, setAllDestinations] = useState<Destination[]>([]);
  // Cancel modal
  const [cancelModal, setCancelModal] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadQueue = useCallback(async () => {
    try { const res = await api.get('/admission/queue'); setQueue(res.data); }
    catch (err) { console.error(err); }
  }, []);

  const fetchCounterStatus = useCallback(async (counterId: string) => {
    try {
      const res = await api.get(`/counters/${counterId}`);
      setCounterStatus(res.data.status || 'STANDBY');
    } catch (err) {
      console.error('Failed to fetch counter status', err);
    }
  }, []);

  const loadCounters = useCallback(async () => {
    try {
      const res = await api.get('/counters');
      const c = res.data.filter((c: any) => c.canHandleAdmission && c.isActive);
      setCounters(c);
      
      const saved = localStorage.getItem('activeAdmissionCounter');
      if (saved) {
        setSelectedCounter(saved);
        setIsLocked(true);
        fetchCounterStatus(saved);
      }
    } catch (err) {
      console.error('Failed to load counters:', err);
    }
  }, [fetchCounterStatus]);

  const saveCounterLock = () => {
    if (!tempCounter) return alert('Silakan pilih counter');
    localStorage.setItem('activeAdmissionCounter', tempCounter);
    setSelectedCounter(tempCounter);
    setIsLocked(true);
    fetchCounterStatus(tempCounter);
  };

  const toggleCounterStatus = async () => {
    if (!selectedCounter) return;
    const newStatus = counterStatus === 'BUSY' ? 'STANDBY' : 'BUSY';
    try {
      await api.put(`/counters/${selectedCounter}/status`, { status: newStatus });
      setCounterStatus(newStatus);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengubah status counter');
    }
  };

  useEffect(() => {
    loadQueue();
    loadCounters();
    api.get('/schedules/active-today').then(res => {
      setSchedules(res.data);
    }).catch(() => {});
    // Load destinations for this unit
    api.get('/admission/destinations').then(res => {
      setDestinations(res.data);
      // All destinations for transfer (includes all units)
      setAllDestinations(res.data);
    }).catch(() => {});

    const socket = getSocket();
    socket.on('counterAssignmentUpdate', () => {
      loadCounters();
    });

    const interval = setInterval(loadQueue, 5000);
    return () => {
      clearInterval(interval);
      socket.off('counterAssignmentUpdate');
    };
  }, [loadQueue, loadCounters]);

  const callPatient = async (ticketId: string) => {
    if (!selectedCounter) { alert('Pilih counter'); return; }
    setActionLoading(ticketId);
    try {
      await api.post(`/admission/${ticketId}/call`, { counterId: selectedCounter });
      await loadQueue();
      if (counterStatus === 'BUSY') {
        setCounterStatus('STANDBY');
      }
    }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const startService = async (ticketId: string) => {
    setActionLoading(ticketId);
    try { await api.post(`/admission/${ticketId}/start`); await loadQueue(); }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const finishService = async (ticket: any) => {
    if (!ticket.visit?.selectedScheduleId) {
      setCompletingTicket(ticket);
      openPatientModal(ticket);
      return;
    }
    // Open destination modal to choose next unit
    setDestModal(ticket);
  };

  const confirmFinish = async (ticket: any, nextUnitType: string) => {
    setDestModal(null);
    setActionLoading(ticket.id);
    try {
      await api.post(`/admission/${ticket.id}/finish`, { nextUnitType });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const openPatientModal = (ticket: any) => {
    const v = ticket.visit;
    setPatientForm({
      patientRmNo: v?.patientRmNo || '',
      patientName: v?.patientName || '',
      scheduleId: v?.selectedScheduleId || ticket.selectedScheduleId || '',
      doctorTicketNo: v?.doctorTicketNo || '',
    });
    setPatientModal(ticket);
  };

  const closePatientModal = () => {
    setPatientModal(null);
    setCompletingTicket(null);
  };

  const savePatientData = async () => {
    try {
      await api.put(`/admission/${patientModal.id}/patient-data`, patientForm);
      const isFinishing = completingTicket && completingTicket.id === patientModal.id;
      const savedTicket = patientModal;
      
      setPatientModal(null);
      setCompletingTicket(null);
      await loadQueue();

      if (isFinishing) {
        const updatedTicket = {
          ...savedTicket,
          visit: {
            ...savedTicket.visit,
            selectedScheduleId: patientForm.scheduleId,
          }
        };
        setDestModal(updatedTicket);
      }
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
  };

  const openTimeModal = (ticket: any) => {
    setTimeForm({ field: 'calledAt', correctedTime: '', reason: '' });
    setTimeModal(ticket);
  };

  const saveTimeCorrection = async () => {
    if (!timeForm.correctedTime || !timeForm.reason) { alert('Lengkapi data'); return; }
    try {
      await api.post(`/admission/${timeModal.id}/correct-time`, timeForm);
      setTimeModal(null);
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
  };

  const openTransferModal = (ticket: any) => {
    setTransferReason('');
    setTransferModal(ticket);
  };

  const confirmTransfer = async (ticket: any, targetUnitType: string) => {
    if (!transferReason.trim()) { alert('Masukkan alasan transfer'); return; }
    setTransferModal(null);
    setActionLoading(ticket.id);
    try {
      await api.post(`/admission/${ticket.id}/transfer`, {
        targetUnitType,
        reason: transferReason,
      });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const openCancelModal = (ticket: any) => {
    setCancelReason('');
    setCancelModal(ticket);
  };

  const confirmCancel = async () => {
    if (!cancelModal) return;
    if (!cancelReason.trim()) { alert('Masukkan alasan batal'); return; }
    setCancelModal(null);
    setActionLoading(cancelModal.id);
    try {
      await api.post(`/admission/${cancelModal.id}/cancel`, { reason: cancelReason });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal membatalkan tiket'); }
    finally { setActionLoading(null); }
  };

  const holdTicket = async (ticketId: string) => {
    setActionLoading(ticketId);
    try {
      await api.post(`/admission/${ticketId}/hold`);
      await loadQueue();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal me-hold antrean');
    } finally {
      setActionLoading(null);
    }
  };

  const waitingTickets = queue.filter(t => {
    const session = t.visit?.journeySessions?.[0];
    return t.status === 'WAITING' || (t.status === 'IN_PROGRESS' && session?.status === 'SKIPPED');
  });
  const calledTickets = queue.filter(t => {
    const session = t.visit?.journeySessions?.[0];
    return t.status === 'IN_PROGRESS' && session && ['CALLED', 'SERVING'].includes(session.status);
  });

  return (
    <div className={styles.page}>
      {!isLocked && counters.length > 0 && (
        <div className={styles.modalOverlay} style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 9999 }}>
          <div className={styles.modal} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h3 className={styles.modalTitle} style={{ fontSize: '1.5rem', marginBottom: '20px' }}>🔒 Kunci Sesi Counter</h3>
            <p style={{ marginBottom: '20px', color: '#475569' }}>Silakan pilih counter tempat Anda bertugas saat ini.</p>
            <div className="form-group">
              <select className="form-input" value={tempCounter} onChange={e => setTempCounter(e.target.value)} style={{ padding: '12px', fontSize: '1rem' }}>
                <option value="">-- Pilih Counter Admisi --</option>
                {counters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px', padding: '12px', fontSize: '1rem' }} onClick={saveCounterLock}>Mulai Sesi Jaga</button>
          </div>
        </div>
      )}

      {isLocked && (
        <div className={`glass-card ${styles.counterBar}`} style={{ background: '#ecfdf5', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className={styles.counterLabel} style={{ color: '#047857', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📍 Counter Aktif: <strong>{counters.find(c => c.id === selectedCounter)?.name}</strong>
            {counterStatus === 'BUSY' && <span className="badge" style={{ backgroundColor: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>SEDANG MELAYANI</span>}
          </span>
          <button 
            className={`btn ${counterStatus === 'BUSY' ? 'btn-success' : 'btn-danger'} btn-sm`} 
            style={{ 
              padding: '6px 14px', 
              fontSize: '0.85rem', 
              fontWeight: '600',
              borderRadius: '6px',
              cursor: 'pointer',
              border: 'none',
              color: 'white',
              background: counterStatus === 'BUSY' ? '#10b981' : '#ef4444'
            }}
            onClick={toggleCounterStatus}
          >
            {counterStatus === 'BUSY' ? '🟢 Set Aktif (Standby)' : '🔴 Set Sibuk (Melayani)'}
          </button>
          <span style={{ fontSize: '0.85rem', color: '#059669', marginLeft: 'auto' }}>
            (Untuk pindah counter, silakan Logout lalu Login kembali)
          </span>
        </div>
      )}

      <div className={styles.columns}>
        {/* Waiting Queue */}
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>⏳ Menunggu ({waitingTickets.length})</h3></div>
          <div className={styles.queueList}>
            {waitingTickets.length === 0 ? <div className={styles.empty}>Tidak ada pasien menunggu</div> : waitingTickets.map(ticket => (
              <div key={ticket.id} className={styles.queueCard}>
                <div className={styles.ticketHeader}>
                  <span className={styles.ticketNo}>{ticket.ticketNo}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {ticket.visit?.journeySessions?.[0]?.status === 'SKIPPED' && (
                      <span className="badge" style={{ backgroundColor: '#f59e0b', color: '#fff' }}>HOLD</span>
                    )}
                    <span className={`badge ${ticket.patientType === 'UMUM' ? 'badge-primary' : 'badge-info'}`}>{ticket.patientType}</span>
                  </div>
                </div>
                <div className={styles.ticketInfo}>
                  <span>👨‍⚕️ {ticket.selectedDoctor?.doctorName || '-'}</span>
                  <span>🚪 {ticket.selectedRoom?.name || '-'}</span>
                </div>
                <div className={styles.ticketTime}>{new Date(ticket.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => callPatient(ticket.id)} disabled={actionLoading === ticket.id}>
                    {actionLoading === ticket.id ? '...' : (ticket.visit?.journeySessions?.[0]?.status === 'SKIPPED' ? '📢 Panggil Ulang' : '📢 Panggil')}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => openCancelModal(ticket)} title="Batal/Drop" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* In Progress */}
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>🔄 Sedang Dilayani ({calledTickets.length})</h3></div>
          <div className={styles.queueList}>
            {calledTickets.length === 0 ? <div className={styles.empty}>Tidak ada</div> : calledTickets.map(ticket => {
              const session = ticket.visit?.journeySessions?.[0];
              const isCalled = session?.status === 'CALLED';
              const isServing = session?.status === 'SERVING';
              return (
                <div key={ticket.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                  <div className={styles.ticketHeader}>
                    <span className={styles.ticketNo}>{ticket.ticketNo}</span>
                    <span className={`badge ${isCalled ? 'badge-warning' : 'badge-success'}`}>{isCalled ? 'DIPANGGIL' : 'DILAYANI'}</span>
                  </div>
                  <div className={styles.ticketInfo}>
                    <span>👨‍⚕️ {ticket.selectedDoctor?.doctorName || '-'}</span>
                    <span>🖥️ {session?.counter?.name || '-'}</span>
                    {ticket.visit?.patientName && <span>👤 {ticket.visit.patientName}</span>}
                    {ticket.visit?.patientRmNo && !ticket.visit.patientRmNo.startsWith('REG-') && (
                      <span>📋 RM: {ticket.visit.patientRmNo}</span>
                    )}
                  </div>
                  <div className={styles.actionBtns}>
                    {(isCalled || isServing) && (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => finishService(ticket)} disabled={actionLoading === ticket.id} style={{ flex: 1 }}>✅ Selesai</button>
                        <button className="btn btn-warning btn-sm" onClick={() => callPatient(ticket.id)} disabled={actionLoading === ticket.id}>🔁 Ulang</button>
                      </>
                    )}
                    <button className="btn btn-warning btn-sm" onClick={() => holdTicket(ticket.id)} title="Hold/Pause" style={{ background: '#d97706', color: '#fff', borderColor: '#d97706' }}>⏸️</button>
                    <button className="btn btn-danger btn-sm" onClick={() => openCancelModal(ticket)} title="Batal/Drop" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Patient Data Modal */}
      {patientModal && (
        <div className={styles.modalOverlay} onClick={closePatientModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>👤 Data Pasien — {patientModal.ticketNo}</h3>
            <div className="form-group">
              <label className="form-label">Dokter Tujuan *</label>
              <select
                className="form-select"
                value={patientForm.scheduleId}
                onChange={async (e) => {
                  const val = e.target.value;
                  setPatientForm(prev => ({ ...prev, scheduleId: val }));
                  if (val) {
                    try {
                      const res = await api.get(`/admission/next-doctor-ticket?scheduleId=${val}`);
                      setPatientForm(prev => ({ ...prev, doctorTicketNo: res.data.nextDoctorTicketNo }));
                    } catch (err) {
                      console.error(err);
                    }
                  } else {
                    setPatientForm(prev => ({ ...prev, doctorTicketNo: '' }));
                  }
                }}
              >
                <option value="">-- Pilih Dokter Tujuan --</option>
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>{s.doctor?.doctorName} - Poli {s.room?.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nomor Antrian Dokter (Opsional)</label>
              <input className="form-input" value={patientForm.doctorTicketNo} onChange={e => setPatientForm({ ...patientForm, doctorTicketNo: e.target.value })} placeholder="Otomatis digenerate jika kosong" />
            </div>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={closePatientModal}>Batal</button>
              <button className="btn btn-primary" onClick={savePatientData}>💾 Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Time Correction Modal */}
      {timeModal && (
        <div className={styles.modalOverlay} onClick={() => setTimeModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>⏱️ Koreksi Waktu — {timeModal.ticketNo}</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: 16 }}>Fitur &quot;Lupa klik&quot; — koreksi waktu jika operator terlambat menekan tombol.</p>
            <div className="form-group"><label className="form-label">Field yang dikoreksi</label>
              <select className="form-select" value={timeForm.field} onChange={e => setTimeForm({ ...timeForm, field: e.target.value })}>
                <option value="calledAt">Waktu Panggil</option>
                <option value="serviceStartedAt">Waktu Mulai Layani</option>
                <option value="serviceFinishedAt">Waktu Selesai</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Waktu Sebenarnya</label><input className="form-input" type="datetime-local" value={timeForm.correctedTime} onChange={e => setTimeForm({ ...timeForm, correctedTime: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Alasan Koreksi</label><input className="form-input" value={timeForm.reason} onChange={e => setTimeForm({ ...timeForm, reason: e.target.value })} placeholder="Contoh: Lupa klik tombol mulai" /></div>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setTimeModal(null)}>Batal</button>
              <button className="btn btn-warning" onClick={saveTimeCorrection}>⏱️ Koreksi</button>
            </div>
          </div>
        </div>
      )}

      {/* Destination Modal — Choose next unit after finishing admission */}
      {destModal && (
        <div className={styles.modalOverlay} onClick={() => setDestModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>🗺️ Tujuan Selanjutnya — {destModal.ticketNo}</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: 16 }}>Pilih unit tujuan pasien setelah admisi selesai.</p>
            <div className={styles.destGrid}>
              {destinations.map(dest => (
                <button
                  key={dest.unitType}
                  className={`${styles.destBtn} ${dest.isDefault ? styles.destDefault : ''}`}
                  onClick={() => confirmFinish(destModal, dest.unitType)}
                  style={dest.unitType === 'FINISHED' ? { gridColumn: '1 / -1' } : undefined}
                >
                  <div className={styles.destIcon}>{dest.icon}</div>
                  <div className={styles.destLabel}>{dest.label}</div>
                  {dest.isDefault && <div className={styles.destBadge}>Default</div>}
                </button>
              ))}
            </div>
            <button className={styles.modalClose} onClick={() => setDestModal(null)}>Batal</button>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferModal && (
        <div className={styles.modalOverlay} onClick={() => setTransferModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>🔄 Transfer Pasien — {transferModal.ticketNo}</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: 16 }}>Pindahkan pasien ke unit lain. Sesi saat ini akan ditandai sebagai TRANSFERRED.</p>
            <div className="form-group">
              <label className="form-label">Alasan Transfer *</label>
              <input className="form-input" value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="Contoh: Pasien langsung ke dokter, skip pengkajian" />
            </div>
            <div className={styles.destGrid}>
              {destinations.filter(d => d.unitType !== 'ADMISSION').map(dest => (
                <button
                  key={dest.unitType}
                  className={styles.destBtn}
                  onClick={() => confirmTransfer(transferModal, dest.unitType)}
                  style={dest.unitType === 'FINISHED' ? { gridColumn: '1 / -1' } : undefined}
                >
                  <div className={styles.destIcon}>{dest.icon}</div>
                  <div className={styles.destLabel}>{dest.label}</div>
                </button>
              ))}
            </div>
            <button className={styles.modalClose} onClick={() => setTransferModal(null)}>Batal</button>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className={styles.modalOverlay} onClick={() => setCancelModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle} style={{ color: '#ef4444' }}>❌ Batalkan / Drop Antrean — {cancelModal.ticketNo}</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: 16 }}>
              Apakah Anda yakin ingin membatalkan antrean ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Alasan Batal / Drop *</label>
              <input 
                className="form-input" 
                value={cancelReason} 
                onChange={e => setCancelReason(e.target.value)} 
                placeholder="Contoh: Pasien tidak jadi berobat / Testing petugas" 
                autoFocus
              />
            </div>
            <div className={styles.modalActions} style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setCancelModal(null)}>Batal</button>
              <button 
                className="btn btn-danger" 
                onClick={confirmCancel} 
                style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444' }}
                disabled={!cancelReason.trim()}
              >
                💾 Simpan Pembatalan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
