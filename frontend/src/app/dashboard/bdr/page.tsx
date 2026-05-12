'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../unit-queue.module.css';

export default function BdrPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const params = selectedFloor ? `?floorId=${selectedFloor}` : '';
      const res = await api.get(`/bdr/queue${params}`);
      setQueue(res.data);
    } catch (err) { console.error(err); }
  }, [selectedFloor]);

  useEffect(() => {
    api.get('/floors').then(res => setFloors(res.data)).catch(() => {});
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
                  <span className={styles.ticketNo}>{v.queueTicket?.ticketNo}</span>
                  <span className="badge badge-warning">WAITING</span>
                </div>
                <div className={styles.ticketInfo}>
                  <span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span>
                  <span>🏢 {v.selectedFloor?.name || '-'}</span>
                </div>
                <button className="btn btn-warning btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => action(v.id, 'call')} disabled={actionLoading === v.id}>📢 Panggil</button>
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
                    <span className={styles.ticketNo}>{v.queueTicket?.ticketNo}</span>
                    <span className={`badge ${s?.status === 'CALLED' ? 'badge-warning' : 'badge-success'}`}>{s?.status}</span>
                  </div>
                  <div className={styles.actionBtns}>
                    {s?.status === 'CALLED' && <button className="btn btn-success btn-sm" onClick={() => action(v.id, 'start')} disabled={actionLoading === v.id}>▶️ Mulai</button>}
                    {s?.status === 'SERVING' && <button className="btn btn-primary btn-sm" onClick={() => action(v.id, 'finish')} disabled={actionLoading === v.id}>✅ Selesai → Dokter</button>}
                    {s?.status === 'CALLED' && <button className="btn btn-secondary btn-sm" onClick={() => action(v.id, 'call')} disabled={actionLoading === v.id}>🔁 Ulang</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
