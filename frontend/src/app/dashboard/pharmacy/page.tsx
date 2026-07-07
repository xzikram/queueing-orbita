'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../unit-queue.module.css';

export default function PharmacyPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualTicket, setManualTicket] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return alert('Nama pasien wajib diisi');
    
    setSubmittingManual(true);
    try {
      await api.post('/pharmacy/manual', {
        patientName: manualName,
        ticketNo: manualTicket || undefined
      });
      setManualName('');
      setManualTicket('');
      await loadQueue();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menambahkan antrean');
    } finally {
      setSubmittingManual(false);
    }
  };

  const loadQueue = useCallback(async () => {
    try { const res = await api.get('/pharmacy/queue'); setQueue(res.data); }
    catch (err) { console.error(err); }
  }, []);

  useEffect(() => { loadQueue(); const i = setInterval(loadQueue, 5000); return () => clearInterval(i); }, [loadQueue]);

  const action = async (visitId: string, endpoint: string) => {
    setActionLoading(visitId);
    try { await api.post(`/pharmacy/${visitId}/${endpoint}`); await loadQueue(); }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const waiting = queue.filter(v => v.currentStatus === 'WAITING');
  const processing = queue.filter(v => v.currentStatus === 'SERVING');
  const ready = queue.filter(v => v.currentStatus === 'READY' || v.currentStatus === 'CALLED');
  const pharmacyDone = queue.filter(v => v.currentStatus === 'PHARMACY_DONE');

  return (
    <div className={styles.unitPage}>
      {/* Toolbar Manual Input */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center', background: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)', marginRight: 'auto', margin: 0 }}>
          ➕ Tambah Antrean Obat Manual
        </h3>
        <form onSubmit={handleAddManual} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Nama Pasien (Wajib)" 
            style={{ width: '220px' }}
            required
            value={manualName}
            onChange={e => setManualName(e.target.value)}
          />
          <input 
            type="text" 
            className="form-input" 
            placeholder="No. Antrean (Kosongkan utk auto)" 
            style={{ width: '240px' }}
            value={manualTicket}
            onChange={e => setManualTicket(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={submittingManual}>
            {submittingManual ? 'Menyimpan...' : 'Tambah Antrean'}
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 20 }}>
        {/* Column: Waiting to Process */}
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>⏳ Antrian Obat ({waiting.length})</h3></div>
          <div className={styles.queueList}>
            {waiting.length === 0 ? <div className={styles.empty}>Tidak ada</div> : waiting.map((v: any) => (
              <div key={v.id} className={styles.queueCard}>
                <div className={styles.ticketHeader}><span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span><span className="badge badge-warning">WAITING</span></div>
                {v.patientName && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>👤 {v.patientName}</div>}
                <button className="btn btn-success btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => action(v.id, 'start-process')} disabled={actionLoading === v.id}>🧪 Siapkan Obat</button>
              </div>
            ))}
          </div>
        </div>

        {/* Column: Being Prepared */}
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>🧪 Disiapkan ({processing.length})</h3></div>
          <div className={styles.queueList}>
            {processing.length === 0 ? <div className={styles.empty}>Tidak ada</div> : processing.map((v: any) => (
              <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                <div className={styles.ticketHeader}><span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span><span className="badge badge-primary">PROCESSING</span></div>
                {v.patientName && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>👤 {v.patientName}</div>}
                <button className="btn btn-warning btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => action(v.id, 'ready')} disabled={actionLoading === v.id}>✅ Obat Siap</button>
              </div>
            ))}
          </div>
        </div>

        {/* Column: Ready — Call & Finish */}
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>📢 Siap Ambil ({ready.length})</h3></div>
          <div className={styles.queueList}>
            {ready.length === 0 ? <div className={styles.empty}>Tidak ada</div> : ready.map((v: any) => (
              <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                <div className={styles.ticketHeader}><span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span><span className={`badge ${v.currentStatus === 'READY' ? 'badge-success' : 'badge-info'}`}>{v.currentStatus}</span></div>
                {v.patientName && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>👤 {v.patientName}</div>}
                <div className={styles.actionBtns}>
                  {v.currentStatus === 'READY' && <button className="btn btn-warning btn-sm" onClick={() => action(v.id, 'call')} disabled={actionLoading === v.id}>📢 Panggil</button>}
                  <button className="btn btn-primary btn-sm" onClick={() => action(v.id, 'finish')} disabled={actionLoading === v.id}>💊 Serahkan Obat</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column: Pharmacy Done — Pasien Pulang */}
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>🏠 Pasien Pulang ({pharmacyDone.length})</h3></div>
          <div className={styles.queueList}>
            {pharmacyDone.length === 0 ? <div className={styles.empty}>Tidak ada pasien menunggu pulang</div> : pharmacyDone.map((v: any) => (
              <div key={v.id} className={`${styles.queueCard}`} style={{ borderLeft: '4px solid #10b981' }}>
                <div className={styles.ticketHeader}><span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span><span className="badge badge-success">OBAT DISERAHKAN</span></div>
                {v.patientName && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>👤 {v.patientName}</div>}
                <button 
                  className="btn btn-sm" 
                  style={{ width: '100%', marginTop: 8, background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', fontWeight: 600 }} 
                  onClick={() => action(v.id, 'finish-visit')} 
                  disabled={actionLoading === v.id}
                >
                  🏠 Pasien Pulang — Selesai Visit
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
