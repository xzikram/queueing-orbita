'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../unit-queue.module.css';

export default function OpticPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try { const res = await api.get('/optic/queue'); setQueue(res.data); }
    catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadQueue(); const i = setInterval(loadQueue, 5000); return () => clearInterval(i); }, [loadQueue]);

  const action = async (visitId: string, endpoint: string) => {
    setActionLoading(visitId);
    try { await api.post(`/optic/${visitId}/${endpoint}`); await loadQueue(); }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const waiting = queue.filter(v => v.journeySessions?.[0]?.status !== 'SERVING');
  const serving = queue.filter(v => v.journeySessions?.[0]?.status === 'SERVING');

  return (
    <div className={styles.unitPage}>
      <div className={styles.columns}>
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>⏳ Menunggu ({waiting.length})</h3></div>
          <div className={styles.queueList}>
            {waiting.length === 0 ? <div className={styles.empty}>Tidak ada</div> : waiting.map((v: any) => (
              <div key={v.id} className={styles.queueCard}>
                <div className={styles.ticketHeader}><span className={styles.ticketNo}>{v.queueTicket?.ticketNo}</span><span className="badge badge-warning">WAITING</span></div>
                <button className="btn btn-success btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => action(v.id, 'start')} disabled={actionLoading === v.id}>▶️ Mulai Optik</button>
              </div>
            ))}
          </div>
        </div>
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>🔄 Sedang Dilayani ({serving.length})</h3></div>
          <div className={styles.queueList}>
            {serving.length === 0 ? <div className={styles.empty}>Tidak ada</div> : serving.map((v: any) => (
              <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                <div className={styles.ticketHeader}><span className={styles.ticketNo}>{v.queueTicket?.ticketNo}</span><span className="badge badge-success">SERVING</span></div>
                <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => action(v.id, 'finish')} disabled={actionLoading === v.id}>✅ Selesai (Pulang)</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
