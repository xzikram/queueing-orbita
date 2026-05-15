'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../unit-queue.module.css';

export default function DoctorQueuePage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [destModal, setDestModal] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferReason, setTransferReason] = useState('');

  const loadQueue = useCallback(async () => {
    try {
      const params = selectedRoom ? `?roomId=${selectedRoom}` : '';
      const res = await api.get(`/doctor-queue/queue${params}`);
      setQueue(res.data);
    } catch (err) { console.error(err); }
  }, [selectedRoom]);

  useEffect(() => {
    api.get('/rooms').then(res => {
      const doctorRooms = res.data.filter((r: any) => ['DOCTOR', 'DOCTOR_CHILD'].includes(r.roomType));
      setRooms(doctorRooms);
    }).catch(() => {});
    api.get('/doctor-queue/destinations').then(res => setDestinations(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  const action = async (visitId: string, endpoint: string, body?: any) => {
    setActionLoading(visitId);
    try {
      await api.post(`/doctor-queue/${visitId}/${endpoint}`, body || {});
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const setDestination = async (visitId: string, destination: string) => {
    setDestModal(null);
    setActionLoading(visitId);
    try {
      await api.post(`/doctor-queue/${visitId}/next-destination`, { destination });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const confirmTransfer = async (visitId: string, targetUnitType: string) => {
    if (!transferReason.trim()) { alert('Masukkan alasan transfer'); return; }
    setTransferModal(null);
    setActionLoading(visitId);
    try {
      await api.post(`/doctor-queue/${visitId}/transfer`, { targetUnitType, reason: transferReason });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const waiting = queue.filter(v => v.journeySessions?.[0]?.status === 'WAITING');
  const active = queue.filter(v => ['CALLED', 'SERVING'].includes(v.journeySessions?.[0]?.status));
  const needDest = queue.filter(v => v.currentStatus === 'WAITING_DESTINATION');

  return (
    <div className={styles.unitPage}>
      <div className={`glass-card ${styles.filterBar}`}>
        <span className={styles.filterLabel}>Filter Ruangan:</span>
        <div className={styles.filterSelect}>
          <button className={`${styles.filterBtn} ${!selectedRoom ? styles.filterActive : ''}`} onClick={() => setSelectedRoom('')}>Semua</button>
          {rooms.map((r: any) => (
            <button key={r.id} className={`${styles.filterBtn} ${selectedRoom === r.id ? styles.filterActive : ''}`} onClick={() => setSelectedRoom(r.id)}>{r.name}</button>
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
                  <span className={styles.ticketNo}>{v.queueTicket?.ticketNo}</span>
                  <span className="badge badge-warning">WAITING</span>
                </div>
                <div className={styles.ticketInfo}>
                  <span>👨‍⚕️ {v.selectedDoctor?.doctorName}</span>
                  <span>🚪 {v.selectedRoom?.name}</span>
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
          <div className={styles.columnHeader}><h3>🔄 Aktif ({active.length + needDest.length})</h3></div>
          <div className={styles.queueList}>
            {active.length === 0 && needDest.length === 0 ? <div className={styles.empty}>Tidak ada</div> : (
              <>
                {active.map((v: any) => {
                  const s = v.journeySessions?.[0];
                  return (
                    <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                      <div className={styles.ticketHeader}>
                        <span className={styles.ticketNo}>{v.queueTicket?.ticketNo}</span>
                        <span className={`badge ${s?.status === 'CALLED' ? 'badge-warning' : 'badge-success'}`}>{s?.status}</span>
                      </div>
                      <div className={styles.ticketInfo}><span>🚪 {v.selectedRoom?.name}</span></div>
                      <div className={styles.actionBtns}>
                        {s?.status === 'CALLED' && (
                          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <button className="btn btn-warning btn-sm" style={{ flex: 1 }} onClick={() => action(v.id, 'call')} disabled={actionLoading === v.id}>📢 Panggil Ulang</button>
                            <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => action(v.id, 'start')} disabled={actionLoading === v.id}>▶️ Mulai</button>
                          </div>
                        )}
                        {s?.status === 'SERVING' && (
                          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => action(v.id, 'finish')} disabled={actionLoading === v.id}>✅ Selesai</button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal(v.id); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
                      </div>
                    </div>
                  );
                })}
                {needDest.map((v: any) => (
                  <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                    <div className={styles.ticketHeader}>
                      <span className={styles.ticketNo}>{v.queueTicket?.ticketNo}</span>
                      <span className="badge badge-info">PILIH TUJUAN</span>
                    </div>
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
            <h3 className={styles.modalTitle}>Pilih Tujuan Selanjutnya</h3>
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
              <input className="form-input" value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="Contoh: Pindah poli, ganti dokter" />
            </div>
            <div className={styles.destGrid}>
              {destinations.filter((d: any) => d.unitType !== 'DOCTOR').map((dest: any) => (
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
