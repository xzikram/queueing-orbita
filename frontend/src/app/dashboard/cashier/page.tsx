'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import styles from '../unit-queue.module.css';

export default function CashierPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [selectedCounter, setSelectedCounter] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [counterStatus, setCounterStatus] = useState('STANDBY');
  const [tempCounter, setTempCounter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [destModal, setDestModal] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferReason, setTransferReason] = useState('');
  const [syncModal, setSyncModal] = useState<string | null>(null);
  const [targetSyncVisit, setTargetSyncVisit] = useState('');
  const [cancelModal, setCancelModal] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  const loadQueue = useCallback(async () => {
    try { const res = await api.get('/cashier/queue'); setQueue(res.data); }
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
      const cashierCounters = res.data.filter((c: any) => c.canHandleCashier && c.isActive);
      setCounters(cashierCounters);
      
      const saved = localStorage.getItem('activeCashierCounter');
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
    localStorage.setItem('activeCashierCounter', tempCounter);
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
    const i = setInterval(loadQueue, 5000);
    api.get('/cashier/destinations').then(res => setDestinations(res.data)).catch(() => {});

    const socket = getSocket();
    socket.on('counterAssignmentUpdate', () => {
      loadCounters();
    });

    return () => {
      clearInterval(i);
      socket.off('counterAssignmentUpdate');
    };
  }, [loadQueue, loadCounters]);

  const action = async (visitId: string, endpoint: string, body?: any) => {
    setActionLoading(visitId);
    try { await api.post(`/cashier/${visitId}/${endpoint}`, body || {}); await loadQueue(); }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const setDestination = async (visitId: string, dest: string) => {
    setDestModal(null);
    setActionLoading(visitId);
    try { await api.post(`/cashier/${visitId}/next-destination`, { destination: dest }); await loadQueue(); }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const confirmTransfer = async (visitId: string, targetUnitType: string) => {
    if (!transferReason.trim()) { alert('Masukkan alasan transfer'); return; }
    setTransferModal(null);
    setActionLoading(visitId);
    try {
      await api.post(`/cashier/${visitId}/transfer`, { targetUnitType, reason: transferReason });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const confirmSync = async (sourceVisitId: string) => {
    if (!targetSyncVisit) { alert('Pilih data pasien'); return; }
    setSyncModal(null);
    setActionLoading(sourceVisitId);
    try {
      await api.post(`/cashier/${sourceVisitId}/sync`, { targetVisitId: targetSyncVisit });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); setTargetSyncVisit(''); }
  };

  const openCancelModal = (visit: any) => {
    setCancelReason('');
    setCancelModal(visit);
  };

  const confirmCancel = async () => {
    if (!cancelModal) return;
    if (!cancelReason.trim()) { alert('Masukkan alasan batal'); return; }
    setCancelModal(null);
    setActionLoading(cancelModal.id);
    try {
      await api.post(`/cashier/${cancelModal.id}/cancel`, { reason: cancelReason });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal membatalkan antrean kasir'); }
    finally { setActionLoading(null); }
  };

  const holdVisit = async (visitId: string) => {
    setActionLoading(visitId);
    try {
      await api.post(`/cashier/${visitId}/hold`);
      await loadQueue();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal me-hold antrean kasir');
    } finally {
      setActionLoading(null);
    }
  };

  const waiting = queue.filter(v => {
    const s = v.journeySessions?.[0];
    return s?.status === 'WAITING' || s?.status === 'SKIPPED';
  });
  const active = queue.filter(v => ['CALLED', 'SERVING'].includes(v.journeySessions?.[0]?.status));
  const needDest = queue.filter(v => v.currentStatus === 'WAITING_DESTINATION');

  return (
    <div className={styles.unitPage}>
      {!isLocked && counters.length > 0 && (
        <div className={styles.modalOverlay} style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 9999 }}>
          <div className={styles.modal} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h3 className={styles.modalTitle} style={{ fontSize: '1.5rem', marginBottom: '20px' }}>🔒 Kunci Sesi Counter</h3>
            <p style={{ marginBottom: '20px', color: '#475569' }}>Silakan pilih counter tempat Anda bertugas saat ini.</p>
            <div className="form-group">
              <select className="form-input" value={tempCounter} onChange={e => setTempCounter(e.target.value)} style={{ padding: '12px', fontSize: '1rem' }}>
                <option value="">-- Pilih Counter Kasir --</option>
                {counters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '10px', padding: '12px', fontSize: '1rem' }} onClick={saveCounterLock}>Mulai Sesi Jaga</button>
          </div>
        </div>
      )}

      {isLocked && (
        <div className={`glass-card ${styles.filterBar}`} style={{ background: '#ecfdf5', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className={styles.filterLabel} style={{ color: '#047857', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📍 Counter Aktif: <strong>{counters.find(c => c.id === selectedCounter)?.name}</strong>
            {counterStatus === 'BUSY' && <span className="badge" style={{ backgroundColor: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>SIBUK</span>}
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
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>⏳ Menunggu ({waiting.length})</h3></div>
          <div className={styles.queueList}>
            {waiting.length === 0 ? <div className={styles.empty}>Tidak ada</div> : waiting.map((v: any) => (
              <div key={v.id} className={styles.queueCard}>
                <div className={styles.ticketHeader}>
                  <span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {v.journeySessions?.[0]?.status === 'SKIPPED' && (
                      <span className="badge" style={{ backgroundColor: '#f59e0b', color: '#fff' }}>HOLD</span>
                    )}
                    <span className="badge badge-warning">WAITING</span>
                  </div>
                </div>
                <div className={styles.ticketInfo}><span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span></div>
                <div className={styles.actionBtns}>
                  <button className="btn btn-warning btn-sm" style={{ flex: 1 }} onClick={() => action(v.id, 'call', { counterId: selectedCounter })} disabled={actionLoading === v.id || !selectedCounter}>
                    {v.journeySessions?.[0]?.status === 'SKIPPED' ? '📢 Panggil Ulang' : '📢 Panggil'}
                  </button>
                  <button className="btn btn-info btn-sm" onClick={() => setSyncModal(v.id)} title="Sync Tiket" style={{ background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }}>🔗</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal(v.id); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
                  <button className="btn btn-danger btn-sm" onClick={() => openCancelModal(v)} title="Batal/Drop" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px' }}>
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
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>🔄 Aktif ({active.length + needDest.length})</h3></div>
          <div className={styles.queueList}>
            {active.length === 0 && needDest.length === 0 ? <div className={styles.empty}>Tidak ada</div> : (
              <>
                {active.map((v: any) => {
                  const s = v.journeySessions?.[0];
                  return (
                    <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                      <div className={styles.ticketHeader}><span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span><span className={`badge ${s?.status === 'CALLED' ? 'badge-warning' : 'badge-success'}`}>{s?.status}</span></div>
                      <div className={styles.actionBtns}>
                        {(s?.status === 'CALLED' || s?.status === 'SERVING') && (
                          <>
                            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => action(v.id, 'finish')} disabled={actionLoading === v.id}>✅ Selesai</button>
                            <button className="btn btn-warning btn-sm" onClick={() => action(v.id, 'call', { counterId: selectedCounter })} disabled={actionLoading === v.id || !selectedCounter}>🔁 Ulang</button>
                          </>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal(v.id); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
                        <button className="btn btn-warning btn-sm" onClick={() => holdVisit(v.id)} title="Hold/Pause" style={{ background: '#d97706', color: '#fff', borderColor: '#d97706' }}>⏸️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => openCancelModal(v)} title="Batal/Drop" style={{ background: '#ef4444', color: '#fff', borderColor: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {needDest.map((v: any) => (
                  <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                    <div className={styles.ticketHeader}><span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span><span className="badge badge-info">PILIH TUJUAN</span></div>
                    <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => setDestModal(v.id)}>🗺️ Pilih Tujuan</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Destination Modal */}
      {destModal && (
        <div className={styles.modalOverlay} onClick={() => setDestModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Tujuan Setelah Kasir</h3>
            <div className={styles.destGrid}>
              {destinations.map((dest: any) => (
                <button key={dest.unitType} className={styles.destBtn} onClick={() => setDestination(destModal, dest.unitType)} style={dest.unitType === 'FINISHED' ? { gridColumn: '1 / -1' } : undefined}>
                  <div className={styles.destIcon}>{dest.icon}</div>
                  <div className={styles.destLabel}>{dest.label}</div>
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
            <div className="form-group">
              <label className="form-label">Alasan Transfer *</label>
              <input className="form-input" value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="Contoh: Pembayaran dibatalkan" />
            </div>
            <div className={styles.destGrid}>
              {destinations.filter((d: any) => d.unitType !== 'CASHIER').map((dest: any) => (
                <button key={dest.unitType} className={styles.destBtn} onClick={() => confirmTransfer(transferModal, dest.unitType)} style={dest.unitType === 'FINISHED' ? { gridColumn: '1 / -1' } : undefined}>
                  <div className={styles.destIcon}>{dest.icon}</div>
                  <div className={styles.destLabel}>{dest.label}</div>
                </button>
              ))}
            </div>
            <button className={styles.modalClose} onClick={() => setTransferModal(null)}>Batal</button>
          </div>
        </div>
      )}

      {/* Sync Modal */}
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
                {waiting
                  .filter((w: any) => w.id !== syncModal && w.patientName)
                  .map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.doctorTicketNo || w.queueTicket?.ticketNo} - {w.patientName}
                    </option>
                  ))
                }
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
            <h3 className={styles.modalTitle} style={{ color: '#ef4444' }}>❌ Batalkan / Drop Kasir — {cancelModal.doctorTicketNo || cancelModal.queueTicket?.ticketNo}</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: 16 }}>
              Apakah Anda yakin ingin membatalkan antrean kasir ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Alasan Batal / Drop *</label>
              <input 
                className="form-input" 
                value={cancelReason} 
                onChange={e => setCancelReason(e.target.value)} 
                placeholder="Contoh: Pasien batal berobat / Testing pembayaran" 
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
