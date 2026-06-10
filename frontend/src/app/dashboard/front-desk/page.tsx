'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import styles from './front-desk.module.css';

interface Destination {
  unitType: string;
  label: string;
  icon: string;
  isDefault?: boolean;
}

export default function FrontDeskPage() {
  const [admissionQueue, setAdmissionQueue] = useState<any[]>([]);
  const [cashierQueue, setCashierQueue] = useState<any[]>([]);
  
  const [counters, setCounters] = useState<any[]>([]);
  const [selectedCounter, setSelectedCounter] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [tempCounter, setTempCounter] = useState('');
  
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Shared Data
  const [schedules, setSchedules] = useState<any[]>([]);
  const [admDestinations, setAdmDestinations] = useState<Destination[]>([]);
  const [cashierDestinations, setCashierDestinations] = useState<Destination[]>([]);

  // Modals
  const [patientModal, setPatientModal] = useState<any>(null);
  const [patientForm, setPatientForm] = useState({ patientRmNo: '', patientName: '', scheduleId: '', doctorTicketNo: '' });
  
  const [timeModal, setTimeModal] = useState<any>(null);
  const [timeForm, setTimeForm] = useState({ field: 'calledAt', correctedTime: '', reason: '' });
  
  const [destModal, setDestModal] = useState<{ ticket: any, type: 'ADMISSION' | 'CASHIER' } | null>(null);
  
  const [transferModal, setTransferModal] = useState<{ ticket: any, type: 'ADMISSION' | 'CASHIER' } | null>(null);
  const [transferReason, setTransferReason] = useState('');
  
  const [syncModal, setSyncModal] = useState<string | null>(null);
  const [targetSyncVisit, setTargetSyncVisit] = useState('');
  const [cancelModal, setCancelModal] = useState<{ ticket: any, type: 'ADMISSION' | 'CASHIER' } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadQueues = useCallback(async () => {
    try { 
      const [admRes, cashRes] = await Promise.all([
        api.get('/admission/queue'),
        api.get('/cashier/queue')
      ]);
      setAdmissionQueue(admRes.data);
      setCashierQueue(cashRes.data);
    } catch (err) { console.error(err); }
  }, []);

  const loadCounters = useCallback(async () => {
    try {
      const res = await api.get('/counters');
      const c = res.data.filter((c: any) => (c.canHandleAdmission || c.canHandleCashier) && c.isActive);
      setCounters(c);
      
      const saved = localStorage.getItem('activeFrontDeskCounter');
      if (saved) {
        setSelectedCounter(saved);
        setIsLocked(true);
      }
    } catch {}
  }, []);

  const saveCounterLock = () => {
    if (!tempCounter) return alert('Silakan pilih counter');
    localStorage.setItem('activeFrontDeskCounter', tempCounter);
    setSelectedCounter(tempCounter);
    setIsLocked(true);
  };

  useEffect(() => {
    loadQueues();
    loadCounters();
    
    api.get('/schedules/active-today').then(res => setSchedules(res.data)).catch(() => {});
    api.get('/admission/destinations').then(res => setAdmDestinations(res.data)).catch(() => {});
    api.get('/cashier/destinations').then(res => setCashierDestinations(res.data)).catch(() => {});

    const socket = getSocket();
    socket.on('counterAssignmentUpdate', () => loadCounters());

    const interval = setInterval(loadQueues, 5000);
    return () => {
      clearInterval(interval);
      socket.off('counterAssignmentUpdate');
    };
  }, [loadQueues, loadCounters]);

  // --- ACTIONS ---
  
  const action = async (id: string, type: 'ADMISSION' | 'CASHIER', endpoint: string, body?: any) => {
    setActionLoading(id);
    try { 
      const prefix = type === 'ADMISSION' ? 'admission' : 'cashier';
      await api.post(`/${prefix}/${id}/${endpoint}`, body || {}); 
      await loadQueues(); 
    }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const callPatient = (ticketId: string, type: 'ADMISSION' | 'CASHIER') => {
    if (!selectedCounter) { alert('Pilih counter'); return; }
    action(ticketId, type, 'call', { counterId: selectedCounter });
  };

  const startService = (ticketId: string, type: 'ADMISSION' | 'CASHIER') => {
    action(ticketId, type, 'start');
  };

  // --- ADMISI SPECIFIC ---
  
  const finishAdmisiService = async (ticket: any) => {
    if (!ticket.visit?.patientRmNo || !ticket.visit?.selectedScheduleId) {
      alert('⚠️ Anda harus mengisi No. RM dan memilih Dokter Tujuan sebelum menyelesaikan layanan Admisi.');
      openPatientModal(ticket);
      return;
    }
    setDestModal({ ticket, type: 'ADMISSION' });
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

  const savePatientData = async () => {
    try {
      await api.put(`/admission/${patientModal.id}/patient-data`, patientForm);
      setPatientModal(null);
      await loadQueues();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
  };

  const saveTimeCorrection = async () => {
    if (!timeForm.correctedTime || !timeForm.reason) { alert('Lengkapi data'); return; }
    try {
      await api.post(`/admission/${timeModal.id}/correct-time`, timeForm);
      setTimeModal(null);
      await loadQueues();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
  };

  // --- KASIR SPECIFIC ---
  
  const confirmSync = async (sourceVisitId: string) => {
    if (!targetSyncVisit) { alert('Pilih data pasien'); return; }
    setSyncModal(null);
    setActionLoading(sourceVisitId);
    try {
      await api.post(`/cashier/${sourceVisitId}/sync`, { targetVisitId: targetSyncVisit });
      await loadQueues();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); setTargetSyncVisit(''); }
  };

  // --- SHARED MODAL ACTIONS ---
  
  const confirmFinishDest = async (nextUnitType: string) => {
    if (!destModal) return;
    const { ticket, type } = destModal;
    setDestModal(null);
    setActionLoading(ticket.id);
    try {
      const prefix = type === 'ADMISSION' ? 'admission' : 'cashier';
      const body = type === 'ADMISSION' ? { nextUnitType } : { destination: nextUnitType };
      const endpoint = type === 'ADMISSION' ? 'finish' : 'next-destination';
      await api.post(`/${prefix}/${ticket.id}/${endpoint}`, body);
      await loadQueues();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const confirmTransfer = async (targetUnitType: string) => {
    if (!transferModal) return;
    if (!transferReason.trim()) { alert('Masukkan alasan transfer'); return; }
    
    const { ticket, type } = transferModal;
    setTransferModal(null);
    setActionLoading(ticket.id);
    try {
      const prefix = type === 'ADMISSION' ? 'admission' : 'cashier';
      await api.post(`/${prefix}/${ticket.id}/transfer`, {
        targetUnitType,
        reason: transferReason,
      });
      await loadQueues();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const openCancelModal = (ticket: any, type: 'ADMISSION' | 'CASHIER') => {
    setCancelReason('');
    setCancelModal({ ticket, type });
  };

  const confirmCancel = async () => {
    if (!cancelModal) return;
    if (!cancelReason.trim()) { alert('Masukkan alasan batal'); return; }
    const { ticket, type } = cancelModal;
    setCancelModal(null);
    setActionLoading(ticket.id);
    try {
      const prefix = type === 'ADMISSION' ? 'admission' : 'cashier';
      await api.post(`/${prefix}/${ticket.id}/cancel`, { reason: cancelReason });
      await loadQueues();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal membatalkan antrean'); }
    finally { setActionLoading(null); }
  };

  const holdAction = async (id: string, type: 'ADMISSION' | 'CASHIER') => {
    setActionLoading(id);
    try {
      const prefix = type === 'ADMISSION' ? 'admission' : 'cashier';
      await api.post(`/${prefix}/${id}/hold`);
      await loadQueues();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal me-hold antrean');
    } finally {
      setActionLoading(null);
    }
  };

  // --- RENDER HELPERS ---
  
  const admWaiting = admissionQueue.filter(t => {
    const session = t.visit?.journeySessions?.[0];
    return t.status === 'WAITING' || (t.status === 'IN_PROGRESS' && session?.status === 'SKIPPED');
  });
  const admActive = admissionQueue.filter(t => {
    const session = t.visit?.journeySessions?.[0];
    return t.status === 'IN_PROGRESS' && session && ['CALLED', 'SERVING'].includes(session.status);
  });

  const cashWaiting = cashierQueue.filter(v => {
    const s = v.journeySessions?.[0];
    return s?.status === 'WAITING' || s?.status === 'SKIPPED';
  });
  const cashActive = cashierQueue.filter(v => ['CALLED', 'SERVING'].includes(v.journeySessions?.[0]?.status));
  const cashNeedDest = cashierQueue.filter(v => v.currentStatus === 'WAITING_DESTINATION');

  return (
    <div className={styles.page}>
      {!isLocked && counters.length > 0 && (
        <div className={styles.modalOverlay} style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 9999 }}>
          <div className={styles.modal} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h3 className={styles.modalTitle} style={{ fontSize: '1.5rem', marginBottom: '20px' }}>🔒 Kunci Sesi Counter</h3>
            <p style={{ marginBottom: '20px', color: '#475569' }}>Silakan pilih counter Front Desk tempat Anda bertugas saat ini.</p>
            <div className="form-group">
              <select className="form-input" value={tempCounter} onChange={e => setTempCounter(e.target.value)} style={{ padding: '12px', fontSize: '1rem' }}>
                <option value="">-- Pilih Counter --</option>
                {counters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px', padding: '12px', fontSize: '1rem' }} onClick={saveCounterLock}>Mulai Sesi Jaga</button>
          </div>
        </div>
      )}

      {isLocked && (
        <div className={`glass-card ${styles.counterBar}`} style={{ background: '#ecfdf5', borderColor: '#10b981' }}>
          <span className={styles.counterLabel} style={{ color: '#047857' }}>
            📍 Counter Aktif: <strong>{counters.find(c => c.id === selectedCounter)?.name}</strong>
          </span>
          <span style={{ fontSize: '0.85rem', color: '#059669', marginLeft: 'auto' }}>
            (Untuk pindah counter, silakan Logout lalu Login kembali)
          </span>
        </div>
      )}

      {/* Tampilan 2 Kolom: Kiri Admisi, Kanan Kasir */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* KOLOM ADMISI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className={`glass-card ${styles.column}`} style={{ borderTop: '4px solid #3b82f6' }}>
            <div className={styles.columnHeader}><h3>🏥 Menunggu Admisi ({admWaiting.length})</h3></div>
            <div className={styles.queueList}>
              {admWaiting.length === 0 ? <div className={styles.empty}>Tidak ada pasien menunggu</div> : admWaiting.map(ticket => (
                <div key={ticket.id} className={styles.compactCard}>
                  <div className={styles.cardLeft}>
                    <div className={styles.ticketHeaderCompact}>
                      <span className={styles.ticketNoCompact}>{ticket.ticketNo}</span>
                      {ticket.visit?.journeySessions?.[0]?.status === 'SKIPPED' && (
                        <span className="badge" style={{ backgroundColor: '#f59e0b', color: '#fff', fontSize: '0.65rem', padding: '2px 6px' }}>HOLD</span>
                      )}
                      <span className={`badge ${ticket.patientType === 'UMUM' ? 'badge-primary' : 'badge-info'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{ticket.patientType}</span>
                    </div>
                    <div className={styles.ticketInfoCompact}>
                      <span>👨‍⚕️ {ticket.selectedDoctor?.doctorName || '-'}</span>
                      {ticket.selectedRoom?.name && <span> • 🚪 {ticket.selectedRoom.name}</span>}
                      <span className={styles.ticketTimeCompact}> ({new Date(ticket.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})</span>
                    </div>
                  </div>
                  <div className={styles.cardRight}>
                    <button className="btn btn-primary btn-sm" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => callPatient(ticket.id, 'ADMISSION')} disabled={actionLoading === ticket.id || !selectedCounter}>
                      {actionLoading === ticket.id ? '...' : (ticket.visit?.journeySessions?.[0]?.status === 'SKIPPED' ? '📢 Panggil Ulang' : '📢 Panggil')}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => openCancelModal(ticket, 'ADMISSION')} title="Batal/Drop" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444', padding: '6px 10px' }}>❌</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`glass-card ${styles.column}`} style={{ borderTop: '4px solid #3b82f6' }}>
            <div className={styles.columnHeader}><h3>🔄 Admisi Aktif ({admActive.length})</h3></div>
            <div className={styles.queueList}>
              {admActive.length === 0 ? <div className={styles.empty}>Tidak ada</div> : admActive.map(ticket => {
                const session = ticket.visit?.journeySessions?.[0];
                const isCalled = session?.status === 'CALLED';
                const isServing = session?.status === 'SERVING';
                return (
                  <div key={ticket.id} className={`${styles.compactCard} ${styles.activeCardCompact}`}>
                    <div className={styles.cardLeft}>
                      <div className={styles.ticketHeaderCompact}>
                        <span className={styles.ticketNoCompact}>{ticket.ticketNo}</span>
                        <span className={`badge ${isCalled ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{isCalled ? 'DIPANGGIL' : 'DILAYANI'}</span>
                      </div>
                      <div className={styles.ticketInfoCompact}>
                        <span>👨‍⚕️ {ticket.selectedDoctor?.doctorName || '-'}</span>
                        <span> • 🖥️ {session?.counter?.name || '-'}</span>
                        {ticket.visit?.patientName && <span> • 👤 {ticket.visit.patientName}</span>}
                        {ticket.visit?.patientRmNo && <span> • 📋 RM: {ticket.visit.patientRmNo}</span>}
                      </div>
                    </div>
                    <div className={styles.cardRight} style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {isCalled && (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => startService(ticket.id, 'ADMISSION')} disabled={actionLoading === ticket.id} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>▶️ Mulai</button>
                          <button className="btn btn-warning btn-sm" onClick={() => callPatient(ticket.id, 'ADMISSION')} disabled={actionLoading === ticket.id} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>🔁 Ulang</button>
                        </>
                      )}
                      {isServing && (
                        <button className="btn btn-primary btn-sm" onClick={() => finishAdmisiService(ticket)} disabled={actionLoading === ticket.id} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>✅ Selesai</button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => openPatientModal(ticket)} title="Data Pasien" style={{ padding: '6px 10px' }}>👤</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setTimeForm({ field: 'calledAt', correctedTime: '', reason: '' }); setTimeModal(ticket); }} title="Koreksi Waktu" style={{ padding: '6px 10px' }}>⏱️</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal({ ticket, type: 'ADMISSION' }); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b', padding: '6px 10px' }}>🔄</button>
                      <button className="btn btn-warning btn-sm" onClick={() => holdAction(ticket.id, 'ADMISSION')} title="Hold/Pause" style={{ background: '#d97706', color: '#fff', borderColor: '#d97706', padding: '6px 10px' }}>⏸️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => openCancelModal(ticket, 'ADMISSION')} title="Batal/Drop" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444', padding: '6px 10px' }}>❌</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* KOLOM KASIR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className={`glass-card ${styles.column}`} style={{ borderTop: '4px solid #10b981' }}>
            <div className={styles.columnHeader}><h3>💳 Menunggu Kasir ({cashWaiting.length})</h3></div>
            <div className={styles.queueList}>
              {cashWaiting.length === 0 ? <div className={styles.empty}>Tidak ada pasien menunggu</div> : cashWaiting.map((v: any) => (
                <div key={v.id} className={styles.compactCard}>
                  <div className={styles.cardLeft}>
                    <div className={styles.ticketHeaderCompact}>
                      <span className={styles.ticketNoCompact}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span>
                      {v.journeySessions?.[0]?.status === 'SKIPPED' && (
                        <span className="badge" style={{ backgroundColor: '#f59e0b', color: '#fff', fontSize: '0.65rem', padding: '2px 6px' }}>HOLD</span>
                      )}
                      <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>WAITING</span>
                    </div>
                    <div className={styles.ticketInfoCompact}>
                      <span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span>
                      {v.patientName && <span> • 👤 {v.patientName}</span>}
                    </div>
                  </div>
                  <div className={styles.cardRight}>
                    <button className="btn btn-warning btn-sm" style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#fff', padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => callPatient(v.id, 'CASHIER')} disabled={actionLoading === v.id || !selectedCounter}>
                      {v.journeySessions?.[0]?.status === 'SKIPPED' ? '📢 Panggil Ulang' : '📢 Panggil'}
                    </button>
                    <button className="btn btn-info btn-sm" onClick={() => setSyncModal(v.id)} title="Sync Tiket" style={{ background: '#3b82f6', color: '#fff', borderColor: '#3b82f6', padding: '6px 10px' }}>🔗</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal({ ticket: v, type: 'CASHIER' }); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b', padding: '6px 10px' }}>🔄</button>
                    <button className="btn btn-danger btn-sm" onClick={() => openCancelModal(v, 'CASHIER')} title="Batal/Drop" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444', padding: '6px 10px' }}>❌</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`glass-card ${styles.column}`} style={{ borderTop: '4px solid #10b981' }}>
            <div className={styles.columnHeader}><h3>🔄 Kasir Aktif ({cashActive.length + cashNeedDest.length})</h3></div>
            <div className={styles.queueList}>
              {cashActive.length === 0 && cashNeedDest.length === 0 ? <div className={styles.empty}>Tidak ada</div> : (
                <>
                  {cashActive.map((v: any) => {
                    const s = v.journeySessions?.[0];
                    const isCalled = s?.status === 'CALLED';
                    return (
                      <div key={v.id} className={`${styles.compactCard} ${styles.activeCardCompact}`}>
                        <div className={styles.cardLeft}>
                          <div className={styles.ticketHeaderCompact}>
                            <span className={styles.ticketNoCompact}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span>
                            <span className={`badge ${isCalled ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{s?.status}</span>
                          </div>
                          <div className={styles.ticketInfoCompact}>
                            <span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span>
                            {v.patientName && <span> • 👤 {v.patientName}</span>}
                          </div>
                        </div>
                        <div className={styles.cardRight} style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {isCalled && (
                            <>
                              <button className="btn btn-success btn-sm" onClick={() => startService(v.id, 'CASHIER')} disabled={actionLoading === v.id} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>▶️ Mulai</button>
                              <button className="btn btn-warning btn-sm" onClick={() => callPatient(v.id, 'CASHIER')} disabled={actionLoading === v.id} style={{ padding: '6px 10px', fontSize: '0.8rem' }}>🔁 Ulang</button>
                            </>
                          )}
                          {s?.status === 'SERVING' && (
                            <button className="btn btn-primary btn-sm" style={{ backgroundColor: '#10b981', borderColor: '#10b981', padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => action(v.id, 'CASHIER', 'finish')} disabled={actionLoading === v.id}>
                              ✅ Selesai
                            </button>
                          )}
                          <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal({ ticket: v, type: 'CASHIER' }); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b', padding: '6px 10px' }}>🔄</button>
                          <button className="btn btn-warning btn-sm" onClick={() => holdAction(v.id, 'CASHIER')} title="Hold/Pause" style={{ background: '#d97706', color: '#fff', borderColor: '#d97706', padding: '6px 10px' }}>⏸️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => openCancelModal(v, 'CASHIER')} title="Batal/Drop" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444', padding: '6px 10px' }}>❌</button>
                        </div>
                      </div>
                    );
                  })}
                  {cashNeedDest.map((v: any) => (
                    <div key={v.id} className={`${styles.compactCard} ${styles.activeCardCompact}`}>
                      <div className={styles.cardLeft}>
                        <div className={styles.ticketHeaderCompact}>
                          <span className={styles.ticketNoCompact}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span>
                          <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>PILIH TUJUAN</span>
                        </div>
                        <div className={styles.ticketInfoCompact}>
                          <span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span>
                          {v.patientName && <span> • 👤 {v.patientName}</span>}
                        </div>
                      </div>
                      <div className={styles.cardRight}>
                        <button className="btn btn-primary btn-sm" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setDestModal({ ticket: v, type: 'CASHIER' })}>🗺️ Pilih Tujuan</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* MODALS */}

      {/* Patient Data Modal (Admisi) */}
      {patientModal && (
        <div className={styles.modalOverlay} onClick={() => setPatientModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>👤 Data Pasien — {patientModal.ticketNo}</h3>
            <div className="form-group"><label className="form-label">No. Rekam Medis *</label><input className="form-input" value={patientForm.patientRmNo} onChange={e => setPatientForm({ ...patientForm, patientRmNo: e.target.value })} placeholder="Wajib diisi (Contoh: 000123)" /></div>
            <div className="form-group">
              <label className="form-label">Dokter Tujuan</label>
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
              <button className="btn btn-secondary" onClick={() => setPatientModal(null)}>Batal</button>
              <button className="btn btn-primary" onClick={savePatientData}>💾 Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Time Correction Modal (Admisi) */}
      {timeModal && (
        <div className={styles.modalOverlay} onClick={() => setTimeModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>⏱️ Koreksi Waktu — {timeModal.ticketNo}</h3>
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

      {/* Destination Modal */}
      {destModal && (
        <div className={styles.modalOverlay} onClick={() => setDestModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>🗺️ Tujuan Selanjutnya — {destModal.ticket.doctorTicketNo || destModal.ticket.ticketNo || destModal.ticket.queueTicket?.ticketNo}</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: 16 }}>Pilih unit tujuan pasien selanjutnya.</p>
            <div className={styles.destGrid}>
              {(destModal.type === 'ADMISSION' ? admDestinations : cashierDestinations).map(dest => (
                <button
                  key={dest.unitType}
                  className={`${styles.destBtn} ${dest.isDefault ? styles.destDefault : ''}`}
                  onClick={() => confirmFinishDest(dest.unitType)}
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
            <h3 className={styles.modalTitle}>🔄 Transfer Pasien</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: 16 }}>Pindahkan pasien ke unit lain. Sesi saat ini akan ditandai sebagai TRANSFERRED.</p>
            <div className="form-group">
              <label className="form-label">Alasan Transfer *</label>
              <input className="form-input" value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="Contoh: Pasien langsung ke dokter" />
            </div>
            <div className={styles.destGrid}>
              {(transferModal.type === 'ADMISSION' ? admDestinations : cashierDestinations)
                .filter(d => d.unitType !== transferModal.type)
                .map(dest => (
                <button
                  key={dest.unitType}
                  className={styles.destBtn}
                  onClick={() => confirmTransfer(dest.unitType)}
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

      {/* Sync Modal (Kasir) */}
      {syncModal && (
        <div className={styles.modalOverlay} onClick={() => setSyncModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>🔗 Gabungkan Antrean</h3>
            <p style={{ marginBottom: 15, fontSize: '0.9rem', color: '#64748b' }}>
              Pilih data kunjungan pasien dari Dokter/Poli untuk digabungkan ke tiket Kiosk Kasir ini.
            </p>
            <div className="form-group">
              <select className="form-input" value={targetSyncVisit} onChange={e => setTargetSyncVisit(e.target.value)} style={{ padding: '10px' }}>
                <option value="">-- Pilih Data Pasien --</option>
                {cashWaiting.filter((w: any) => w.id !== syncModal).map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.doctorTicketNo || w.queueTicket?.ticketNo} - {w.patientName || 'Tanpa Nama'}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => confirmSync(syncModal)}>Gabungkan</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setSyncModal(null)}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className={styles.modalOverlay} onClick={() => setCancelModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle} style={{ color: '#ef4444' }}>❌ Batalkan / Drop Antrean ({cancelModal.type === 'ADMISSION' ? 'Admisi' : 'Kasir'})</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: 16 }}>
              Apakah Anda yakin ingin membatalkan antrean ini? Sesi dan status tiket/kunjungan akan diubah menjadi CANCELLED.
            </p>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Alasan Batal / Drop *</label>
              <input 
                className="form-input" 
                value={cancelReason} 
                onChange={e => setCancelReason(e.target.value)} 
                placeholder="Contoh: Pasien batal berobat / Testing petugas" 
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
