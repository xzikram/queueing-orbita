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

  // --- RENDER HELPERS ---
  
  const admWaiting = admissionQueue.filter(t => t.status === 'WAITING');
  const admActive = admissionQueue.filter(t => {
    const session = t.visit?.journeySessions?.[0];
    return t.status === 'IN_PROGRESS' && session && ['CALLED', 'SERVING'].includes(session.status);
  });

  const cashWaiting = cashierQueue.filter(v => v.journeySessions?.[0]?.status === 'WAITING');
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
                <div key={ticket.id} className={styles.queueCard}>
                  <div className={styles.ticketHeader}>
                    <span className={styles.ticketNo}>{ticket.ticketNo}</span>
                    <span className={`badge ${ticket.patientType === 'UMUM' ? 'badge-primary' : 'badge-info'}`}>{ticket.patientType}</span>
                  </div>
                  <div className={styles.ticketInfo}>
                    <span>👨‍⚕️ {ticket.selectedDoctor?.doctorName || '-'}</span>
                    <span>🚪 {ticket.selectedRoom?.name || '-'}</span>
                  </div>
                  <div className={styles.ticketTime}>{new Date(ticket.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                  <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => callPatient(ticket.id, 'ADMISSION')} disabled={actionLoading === ticket.id || !selectedCounter}>
                    {actionLoading === ticket.id ? '...' : '📢 Panggil Admisi'}
                  </button>
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
                  <div key={ticket.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                    <div className={styles.ticketHeader}>
                      <span className={styles.ticketNo}>{ticket.ticketNo}</span>
                      <span className={`badge ${isCalled ? 'badge-warning' : 'badge-success'}`}>{isCalled ? 'DIPANGGIL' : 'DILAYANI'}</span>
                    </div>
                    <div className={styles.ticketInfo}>
                      <span>👨‍⚕️ {ticket.selectedDoctor?.doctorName || '-'}</span>
                      <span>🖥️ {session?.counter?.name || '-'}</span>
                      {ticket.visit?.patientName && <span>👤 {ticket.visit.patientName}</span>}
                      {ticket.visit?.patientRmNo && <span>📋 RM: {ticket.visit.patientRmNo}</span>}
                    </div>
                    <div className={styles.actionBtns}>
                      {isCalled && (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => startService(ticket.id, 'ADMISSION')} disabled={actionLoading === ticket.id}>▶️ Mulai</button>
                          <button className="btn btn-warning btn-sm" onClick={() => callPatient(ticket.id, 'ADMISSION')} disabled={actionLoading === ticket.id}>🔁 Ulang</button>
                        </>
                      )}
                      {isServing && (
                        <button className="btn btn-primary btn-sm" onClick={() => finishAdmisiService(ticket)} disabled={actionLoading === ticket.id} style={{ flex: 1 }}>✅ Selesai</button>
                      )}
                      <button className="btn btn-secondary btn-sm" onClick={() => openPatientModal(ticket)} title="Data Pasien">👤</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setTimeForm({ field: 'calledAt', correctedTime: '', reason: '' }); setTimeModal(ticket); }} title="Koreksi Waktu">⏱️</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal({ ticket, type: 'ADMISSION' }); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
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
                <div key={v.id} className={styles.queueCard}>
                  <div className={styles.ticketHeader}>
                    <span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span>
                    <span className="badge badge-warning">WAITING</span>
                  </div>
                  <div className={styles.ticketInfo}>
                    <span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span>
                    {v.patientName && <span>👤 {v.patientName}</span>}
                  </div>
                  <div className={styles.actionBtns}>
                    <button className="btn btn-warning btn-sm" style={{ flex: 1, backgroundColor: '#10b981', borderColor: '#10b981', color: '#fff' }} onClick={() => callPatient(v.id, 'CASHIER')} disabled={actionLoading === v.id || !selectedCounter}>
                      📢 Panggil Kasir
                    </button>
                    <button className="btn btn-info btn-sm" onClick={() => setSyncModal(v.id)} title="Sync Tiket" style={{ background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }}>🔗</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal({ ticket: v, type: 'CASHIER' }); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
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
                    return (
                      <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                        <div className={styles.ticketHeader}>
                          <span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span>
                          <span className={`badge ${s?.status === 'CALLED' ? 'badge-warning' : 'badge-success'}`}>{s?.status}</span>
                        </div>
                        <div className={styles.ticketInfo}>
                          <span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span>
                          {v.patientName && <span>👤 {v.patientName}</span>}
                        </div>
                        <div className={styles.actionBtns}>
                          {s?.status === 'CALLED' && (
                            <>
                              <button className="btn btn-success btn-sm" onClick={() => startService(v.id, 'CASHIER')} disabled={actionLoading === v.id}>▶️ Mulai</button>
                              <button className="btn btn-warning btn-sm" onClick={() => callPatient(v.id, 'CASHIER')} disabled={actionLoading === v.id}>🔁 Ulang</button>
                            </>
                          )}
                          {s?.status === 'SERVING' && (
                            <button className="btn btn-primary btn-sm" style={{ flex: 1, backgroundColor: '#10b981', borderColor: '#10b981' }} onClick={() => action(v.id, 'CASHIER', 'finish')} disabled={actionLoading === v.id}>
                              ✅ Selesai
                            </button>
                          )}
                          <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal({ ticket: v, type: 'CASHIER' }); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
                        </div>
                      </div>
                    );
                  })}
                  {cashNeedDest.map((v: any) => (
                    <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                      <div className={styles.ticketHeader}>
                        <span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span>
                        <span className="badge badge-info">PILIH TUJUAN</span>
                      </div>
                      <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => setDestModal({ ticket: v, type: 'CASHIER' })}>🗺️ Pilih Tujuan</button>
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
              <select className="form-select" value={patientForm.scheduleId} onChange={e => setPatientForm({ ...patientForm, scheduleId: e.target.value })}>
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

    </div>
  );
}
