'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../unit-queue.module.css';

interface Destination {
  unitType: string;
  label: string;
  icon: string;
  isDefault: boolean;
}

export default function BdrPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [destModal, setDestModal] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferReason, setTransferReason] = useState('');

  const loadQueue = useCallback(async () => {
    try {
      const params = selectedFloor ? `?floorId=${selectedFloor}` : '';
      const res = await api.get(`/bdr/queue${params}`);
      setQueue(res.data);
    } catch (err) { console.error(err); }
  }, [selectedFloor]);

  useEffect(() => {
    api.get('/floors').then(res => setFloors(res.data)).catch(() => {});
    api.get('/bdr/destinations').then(res => setDestinations(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  const action = async (visitId: string, endpoint: string) => {
    setActionLoading(visitId);
    try {
      await api.post(`/bdr/${visitId}/${endpoint}`);
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const finishWithDest = async (visitId: string, nextUnitType: string) => {
    setDestModal(null);
    setActionLoading(visitId);
    try {
      await api.post(`/bdr/${visitId}/finish`, { nextUnitType });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const confirmTransfer = async (visitId: string, targetUnitType: string) => {
    if (!transferReason.trim()) { alert('Masukkan alasan transfer'); return; }
    setTransferModal(null);
    setActionLoading(visitId);
    try {
      await api.post(`/bdr/${visitId}/transfer`, { targetUnitType, reason: transferReason });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const waiting = queue.filter(v => v.journeySessions?.[0]?.status === 'WAITING');
  const active = queue.filter(v => ['CALLED', 'SERVING'].includes(v.journeySessions?.[0]?.status));

  return (
    <div className={styles.unitPage}>
      <div className={`glass-card ${styles.filterBar}`}>
        <span className={styles.filterLabel}>Filter Lantai:</span>
        <div className={styles.filterSelect}>
          <button className={`${styles.filterBtn} ${!selectedFloor ? styles.filterActive : ''}`} onClick={() => setSelectedFloor('')}>Semua</button>
          {floors.map((f: any) => (
            <button key={f.id} className={`${styles.filterBtn} ${selectedFloor === f.id ? styles.filterActive : ''}`} onClick={() => setSelectedFloor(f.id)}>{f.name}</button>
          ))}
        </div>
      </div>
      <div className={styles.columns}>
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>⏳ Menunggu ({waiting.length})</h3></div>
          <div className={styles.queueList}>
            {waiting.length === 0 ? <div className={styles.empty}>Tidak ada</div> : waiting.map((v: any) => (
              <div key={v.id} className={styles.queueCard}>
                <div className={styles.ticketHeader}>
                  <span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span>
                  <span className="badge badge-warning">WAITING</span>
                </div>
                <div className={styles.ticketInfo}>
                  <span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span>
                  <span>🏢 {v.selectedFloor?.name || '-'}</span>
                </div>
                <div className={styles.actionBtns}>
                  <button className="btn btn-warning btn-sm" style={{ flex: 1 }} onClick={() => action(v.id, 'call')} disabled={actionLoading === v.id}>📢 Panggil</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal(v.id); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>🔄 Aktif ({active.length})</h3></div>
          <div className={styles.queueList}>
            {active.length === 0 ? <div className={styles.empty}>Tidak ada</div> : active.map((v: any) => {
              const s = v.journeySessions?.[0];
              return (
                <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                  <div className={styles.ticketHeader}>
                    <span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span>
                    <span className={`badge ${s?.status === 'CALLED' ? 'badge-warning' : 'badge-success'}`}>{s?.status}</span>
                  </div>
                  <div className={styles.actionBtns}>
                    {s?.status === 'CALLED' && <button className="btn btn-success btn-sm" onClick={() => action(v.id, 'start')} disabled={actionLoading === v.id}>▶️ Mulai</button>}
                    {s?.status === 'SERVING' && <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => setDestModal(v.id)} disabled={actionLoading === v.id}>✅ Selesai</button>}
                    {s?.status === 'CALLED' && <button className="btn btn-secondary btn-sm" onClick={() => action(v.id, 'call')} disabled={actionLoading === v.id}>🔁 Ulang</button>}
                    <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal(v.id); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Destination Modal */}
      {destModal && (
        <div className={styles.modalOverlay} onClick={() => setDestModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>🗺️ Tujuan Setelah BDR</h3>
            <div className={styles.destGrid}>
              {destinations.map(dest => (
                <button key={dest.unitType} className={`${styles.destBtn} ${dest.isDefault ? styles.destDefault : ''}`} onClick={() => finishWithDest(destModal, dest.unitType)} style={dest.unitType === 'FINISHED' ? { gridColumn: '1 / -1' } : undefined}>
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
            <div className="form-group">
              <label className="form-label">Alasan Transfer *</label>
              <input className="form-input" value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="Contoh: Skip BDR, langsung ke dokter" />
            </div>
            <div className={styles.destGrid}>
              {destinations.filter(d => d.unitType !== 'BDR').map(dest => (
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
    </div>
  );
}
