'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../unit-queue.module.css';

export default function AssessmentPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [selectedFloor, setSelectedFloor] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const params = selectedFloor ? `?floorId=${selectedFloor}` : '';
      const res = await api.get(`/assessment/queue${params}`);
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
      await api.post(`/assessment/${visitId}/${endpoint}`);
      await loadQueue();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal');
    } finally { setActionLoading(null); }
  };

  const waiting = queue.filter(v => v.journeySessions?.[0]?.status !== 'SERVING');
  const serving = queue.filter(v => v.journeySessions?.[0]?.status === 'SERVING');

  return (
    <div className={styles.unitPage}>
      <div className={`glass-card ${styles.filterBar}`}>
        <span className={styles.filterLabel}>Filter Lantai:</span>
        <div className={styles.filterSelect}>
          <button className={`${styles.filterBtn} ${!selectedFloor ? styles.filterActive : ''}`} onClick={() => setSelectedFloor('')}>Semua</button>
          {floors.map((f: any) => (
            <button key={f.id} className={`${styles.filterBtn} ${selectedFloor === f.id ? styles.filterActive : ''}`} onClick={() => setSelectedFloor(f.id)}>
              {f.name}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.columns}>
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>⏳ Menunggu ({waiting.length})</h3></div>
          <div className={styles.queueList}>
            {waiting.length === 0 ? <div className={styles.empty}>Tidak ada pasien menunggu</div> : waiting.map((v: any) => (
              <div key={v.id} className={styles.queueCard}>
                <div className={styles.ticketHeader}>
                  <span className={styles.ticketNo}>{v.queueTicket?.ticketNo}</span>
                  <span className="badge badge-warning">WAITING</span>
                </div>
                <div className={styles.ticketInfo}>
                  <span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span>
                  <span>🚪 {v.selectedRoom?.name || '-'}</span>
                </div>
                <button className="btn btn-success btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => action(v.id, 'start')} disabled={actionLoading === v.id}>
                  ▶️ Mulai Pengkajian
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>🔄 Sedang Dikaji ({serving.length})</h3></div>
          <div className={styles.queueList}>
            {serving.length === 0 ? <div className={styles.empty}>Tidak ada</div> : serving.map((v: any) => (
              <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                <div className={styles.ticketHeader}>
                  <span className={styles.ticketNo}>{v.queueTicket?.ticketNo}</span>
                  <span className="badge badge-success">SERVING</span>
                </div>
                <div className={styles.ticketInfo}>
                  <span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span>
                </div>
                <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => action(v.id, 'finish')} disabled={actionLoading === v.id}>
                  ✅ Selesai → BDR
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
