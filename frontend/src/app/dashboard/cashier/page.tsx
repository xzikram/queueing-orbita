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
  const [tempCounter, setTempCounter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [destModal, setDestModal] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferReason, setTransferReason] = useState('');
  const [syncModal, setSyncModal] = useState<string | null>(null);
  const [targetSyncVisit, setTargetSyncVisit] = useState('');

  const loadQueue = useCallback(async () => {
    try { const res = await api.get('/cashier/queue'); setQueue(res.data); }
    catch (err) { console.error(err); }
  }, []);

  const loadCounters = useCallback(async () => {
    try {
      const res = await api.get('/counter-assignment/cashier-counters');
      const c = res.data.filter((c: any) => c.isActive);
      if (c.length > 0) {
        setCounters(c);
        setSelectedCounter(prev => c.find((x: any) => x.id === prev) ? prev : c[0].id);
        return;
      }
    } catch {}
    try {
      const res = await api.get('/counters');
      const cashierCounters = res.data.filter((c: any) => c.canHandleCashier && c.isActive);
      setCounters(cashierCounters);
      
      const saved = localStorage.getItem('activeCashierCounter');
      if (saved) {
        setSelectedCounter(saved);
        setIsLocked(true);
      }
    } catch {}
  }, []);

  const saveCounterLock = () => {
    if (!tempCounter) return alert('Silakan pilih counter');
    localStorage.setItem('activeCashierCounter', tempCounter);
    setSelectedCounter(tempCounter);
    setIsLocked(true);
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

  const waiting = queue.filter(v => v.journeySessions?.[0]?.status === 'WAITING');
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
        <div className={`glass-card ${styles.filterBar}`} style={{ background: '#ecfdf5', borderColor: '#10b981' }}>
          <span className={styles.filterLabel} style={{ color: '#047857' }}>
            📍 Counter Aktif: <strong>{counters.find(c => c.id === selectedCounter)?.name}</strong>
          </span>
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
                <div className={styles.ticketHeader}><span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span><span className="badge badge-warning">WAITING</span></div>
                <div className={styles.ticketInfo}><span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span></div>
                <div className={styles.actionBtns}>
                  <button className="btn btn-warning btn-sm" style={{ flex: 1 }} onClick={() => action(v.id, 'call', { counterId: selectedCounter })} disabled={actionLoading === v.id || !selectedCounter}>📢 Panggil</button>
                  <button className="btn btn-info btn-sm" onClick={() => setSyncModal(v.id)} title="Sync Tiket" style={{ background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }}>🔗</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal(v.id); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
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
                        {s?.status === 'CALLED' && <button className="btn btn-success btn-sm" onClick={() => action(v.id, 'start')} disabled={actionLoading === v.id}>▶️ Mulai</button>}
                        {s?.status === 'SERVING' && <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => action(v.id, 'finish')} disabled={actionLoading === v.id}>✅ Selesai</button>}
                        <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal(v.id); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
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
                {waiting.filter((w: any) => w.id !== syncModal).map((w: any) => (
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
