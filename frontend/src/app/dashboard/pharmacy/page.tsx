'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../unit-queue.module.css';

export default function PharmacyPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return alert('Nama pasien wajib diisi');
    
    setSubmittingManual(true);
    try {
      await api.post('/pharmacy/manual', {
        patientName: manualName
      });
      setManualName('');
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
            style={{ width: '320px' }}
            required
            value={manualName}
            onChange={e => setManualName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={submittingManual}>
            {submittingManual ? 'Menyimpan...' : 'Tambah Antrean'}
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Column: Being Prepared */}
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>🧪 Disiapkan ({processing.length})</h3></div>
            {processing.length === 0 ? <div className={styles.empty}>Tidak ada</div> : processing.map((v: any) => (
              <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                <div className={styles.ticketHeader}>
                  <span className={styles.ticketNo}>{v.patientName || v.doctorTicketNo || v.queueTicket?.ticketNo}</span>
                  {v.isPaid ? (
                    <span className="badge badge-success" style={{ backgroundColor: v.paymentCategory === 'BPJS' ? '#2563eb' : '#10b981', color: 'white' }}>
                      {v.paymentCategory === 'BPJS' ? '🛡️ BPJS' : '💳 SUDAH LUNAS'}
                    </span>
                  ) : (
                    <span className="badge badge-warning" style={{ backgroundColor: '#f59e0b', color: 'white' }}>
                      ⏳ BELUM LUNAS
                    </span>
                  )}
                </div>
                {v.selectedDoctor?.doctorName && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>👨‍⚕️ {v.selectedDoctor.doctorName}</div>}
                <button
                  className="btn btn-warning btn-sm"
                  style={{ width: '100%', marginTop: 8, opacity: v.isPaid === false ? 0.5 : 1, cursor: v.isPaid === false ? 'not-allowed' : 'pointer' }}
                  onClick={() => action(v.id, 'ready')}
                  disabled={actionLoading === v.id || v.isPaid === false}
                  title={v.isPaid === false ? 'Pasien belum melunasi pembayaran di Kasir' : 'Tandai obat siap'}
                >
                  {v.isPaid === false ? '🔒 Lock (Belum Lunas)' : '✅ Obat Siap'}
                </button>
              </div>
            ))}
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
                  <button
                    className="btn btn-warning btn-sm"
                    onClick={() => action(v.id, 'call')}
                    disabled={actionLoading === v.id}
                  >
                    {v.currentStatus === 'CALLED' ? '🔄 Panggil Ulang' : '📢 Panggil'}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => action(v.id, 'finish')}
                    disabled={actionLoading === v.id}
                  >
                    💊 Serahkan Obat
                  </button>
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
