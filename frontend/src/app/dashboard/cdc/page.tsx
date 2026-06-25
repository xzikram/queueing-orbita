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

export default function CdcPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [destModal, setDestModal] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferReason, setTransferReason] = useState('');
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [isOtherChecked, setIsOtherChecked] = useState(false);
  const [otherExam, setOtherExam] = useState('');

  const loadQueue = useCallback(async () => {
    try { const res = await api.get('/cdc/queue'); setQueue(res.data); }
    catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    loadQueue();
    api.get('/cdc/destinations').then(res => setDestinations(res.data)).catch(() => {});
    const i = setInterval(loadQueue, 5000);
    return () => clearInterval(i);
  }, [loadQueue]);

  const action = async (visitId: string, endpoint: string, body?: any) => {
    setActionLoading(visitId);
    try { await api.post(`/cdc/${visitId}/${endpoint}`, body || {}); await loadQueue(); }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const finishWithDest = async (visitId: string, nextUnitType: string) => {
    const list = [...selectedExams];
    if (isOtherChecked && otherExam.trim()) {
      list.push(otherExam.trim());
    } else if (isOtherChecked) {
      list.push('Lainnya');
    }
    
    const finalServiceName = list.join(', ');
    if (!finalServiceName) {
      alert('Mohon pilih Jenis Pemeriksaan terlebih dahulu!');
      return;
    }
    setDestModal(null);
    setActionLoading(visitId);
    try {
      await api.post(`/cdc/${visitId}/finish`, { nextUnitType, serviceName: finalServiceName });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const confirmTransfer = async (visitId: string, targetUnitType: string) => {
    if (!transferReason.trim()) { alert('Masukkan alasan transfer'); return; }
    setTransferModal(null);
    setActionLoading(visitId);
    try {
      await api.post(`/cdc/${visitId}/transfer`, { targetUnitType, reason: transferReason });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
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
                <div className={styles.ticketHeader}><span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span><span className="badge badge-warning">WAITING</span></div>
                <div className={styles.ticketInfo}><span>👨‍⚕️ {v.selectedDoctor?.doctorName || '-'}</span></div>
                <div className={styles.actionBtns}>
                  <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => action(v.id, 'start')} disabled={actionLoading === v.id}>▶️ Mulai CDC</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal(v.id); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>🔄 Sedang Dilayani ({serving.length})</h3></div>
          <div className={styles.queueList}>
            {serving.length === 0 ? <div className={styles.empty}>Tidak ada</div> : serving.map((v: any) => (
              <div key={v.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                <div className={styles.ticketHeader}><span className={styles.ticketNo}>{v.doctorTicketNo || v.queueTicket?.ticketNo}</span><span className="badge badge-success">SERVING</span></div>
                <div className={styles.actionBtns}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => { setSelectedExams([]); setIsOtherChecked(false); setOtherExam(''); setDestModal(v.id); }} disabled={actionLoading === v.id}>✅ Selesai</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setTransferReason(''); setTransferModal(v.id); }} title="Transfer" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Destination Modal */}
      {destModal && (
        <div className={styles.modalOverlay} onClick={() => setDestModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>✅ Selesai Layanan CDC</h3>
            
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontWeight: 'bold' }}>Jenis Pemeriksaan *</label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '10px 16px', 
                maxHeight: '180px', 
                overflowY: 'auto', 
                padding: '12px', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-md)', 
                background: '#f8fafc',
                marginBottom: '8px' 
              }}>
                {['OCT', 'Foto Fundus', 'Foto Fundus Non Midriaticum', 'BIOMETRI', 'Humphrey Visual Field', 'USG', 'Pentacam', 'Robo Pachymetry'].map(exam => {
                  const isChecked = selectedExams.includes(exam);
                  return (
                    <label key={exam} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--gray-700)', userSelect: 'none' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExams([...selectedExams, exam]);
                          } else {
                            setSelectedExams(selectedExams.filter(item => item !== exam));
                          }
                        }}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary-500)' }}
                      />
                      {exam}
                    </label>
                  );
                })}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--gray-700)', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={isOtherChecked}
                    onChange={(e) => setIsOtherChecked(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--primary-500)' }}
                  />
                  Lainnya
                </label>
              </div>
              {isOtherChecked && (
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ketik pemeriksaan lainnya..." 
                  value={otherExam}
                  onChange={(e) => setOtherExam(e.target.value)}
                  style={{ marginTop: '8px' }}
                />
              )}
            </div>

            <h4 style={{ marginBottom: '10px', color: '#1e293b' }}>Pilih Tujuan Selanjutnya:</h4>
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
              <input className="form-input" value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="Contoh: Skip CDC" />
            </div>
            <div className={styles.destGrid}>
              {destinations.filter(d => d.unitType !== 'CDC').map(dest => (
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
