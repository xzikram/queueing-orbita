'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from './admission.module.css';

export default function AdmissionPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [selectedCounter, setSelectedCounter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Patient data modal
  const [patientModal, setPatientModal] = useState<any>(null);
  const [patientForm, setPatientForm] = useState({ patientRmNo: '', patientName: '', patientDob: '', scheduleId: '' });
  const [schedules, setSchedules] = useState<any[]>([]);
  // Time correction modal
  const [timeModal, setTimeModal] = useState<any>(null);
  const [timeForm, setTimeForm] = useState({ field: 'calledAt', correctedTime: '', reason: '' });

  const loadQueue = useCallback(async () => {
    try { const res = await api.get('/admission/queue'); setQueue(res.data); }
    catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    loadQueue();
    api.get('/counters').then(res => {
      const c = res.data.filter((c: any) => c.canHandleAdmission && c.isActive);
      setCounters(c);
      if (c.length > 0) setSelectedCounter(c[0].id);
    }).catch(() => {});
    api.get('/schedules/active-today').then(res => {
      setSchedules(res.data);
    }).catch(() => {});
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [loadQueue]);

  const callPatient = async (ticketId: string) => {
    if (!selectedCounter) { alert('Pilih counter'); return; }
    setActionLoading(ticketId);
    try { await api.post(`/admission/${ticketId}/call`, { counterId: selectedCounter }); await loadQueue(); }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const startService = async (ticketId: string) => {
    setActionLoading(ticketId);
    try { await api.post(`/admission/${ticketId}/start`); await loadQueue(); }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const finishService = async (ticket: any) => {
    if (!ticket.visit?.patientName || !ticket.visit?.patientRmNo || !ticket.visit?.selectedScheduleId) {
      alert('⚠️ Anda harus mengisi No. RM, Nama Pasien, dan memilih Dokter Tujuan sebelum menyelesaikan layanan.');
      openPatientModal(ticket);
      return;
    }

    setActionLoading(ticket.id);
    try {
      await api.post(`/admission/${ticket.id}/finish`, {});
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const openPatientModal = (ticket: any) => {
    const v = ticket.visit;
    setPatientForm({
      patientRmNo: v?.patientRmNo || '',
      patientName: v?.patientName || '',
      patientDob: v?.patientDob ? new Date(v.patientDob).toISOString().slice(0, 10) : '',
      scheduleId: v?.selectedScheduleId || '',
    });
    setPatientModal(ticket);
  };

  const savePatientData = async () => {
    try {
      await api.put(`/admission/${patientModal.id}/patient-data`, patientForm);
      setPatientModal(null);
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
  };

  const openTimeModal = (ticket: any) => {
    setTimeForm({ field: 'calledAt', correctedTime: '', reason: '' });
    setTimeModal(ticket);
  };

  const saveTimeCorrection = async () => {
    if (!timeForm.correctedTime || !timeForm.reason) { alert('Lengkapi data'); return; }
    try {
      await api.post(`/admission/${timeModal.id}/correct-time`, timeForm);
      setTimeModal(null);
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
  };

  const waitingTickets = queue.filter(t => t.status === 'WAITING');
  const calledTickets = queue.filter(t => {
    const session = t.visit?.journeySessions?.[0];
    return t.status === 'IN_PROGRESS' && session && ['CALLED', 'SERVING'].includes(session.status);
  });

  return (
    <div className={styles.page}>
      {/* Counter Selector */}
      <div className={`glass-card ${styles.counterBar}`}>
        <label className={styles.counterLabel}>Counter Aktif:</label>
        <div className={styles.counterSelect}>
          {counters.map(c => (
            <button key={c.id} className={`${styles.counterBtn} ${selectedCounter === c.id ? styles.counterActive : ''}`} onClick={() => setSelectedCounter(c.id)}>{c.name}</button>
          ))}
        </div>
      </div>

      <div className={styles.columns}>
        {/* Waiting Queue */}
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>⏳ Menunggu ({waitingTickets.length})</h3></div>
          <div className={styles.queueList}>
            {waitingTickets.length === 0 ? <div className={styles.empty}>Tidak ada pasien menunggu</div> : waitingTickets.map(ticket => (
              <div key={ticket.id} className={styles.queueCard}>
                <div className={styles.ticketHeader}>
                  <span className={styles.ticketNo}>{ticket.ticketNo}</span>
                  <span className={`badge ${ticket.patientType === 'UMUM' ? 'badge-primary' : 'badge-info'}`}>{ticket.patientType}</span>
                </div>
                <div className={styles.ticketInfo}>
                  <span>👨‍⚕️ {ticket.selectedDoctor?.doctorName || '-'}</span>
                  <span>🚪 {ticket.selectedRoom?.name || '-'}</span>
                </div>
                <div className={styles.ticketTime}>{new Date(ticket.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => callPatient(ticket.id)} disabled={actionLoading === ticket.id}>
                  {actionLoading === ticket.id ? '...' : '📢 Panggil'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* In Progress */}
        <div className={`glass-card ${styles.column}`}>
          <div className={styles.columnHeader}><h3>🔄 Sedang Dilayani ({calledTickets.length})</h3></div>
          <div className={styles.queueList}>
            {calledTickets.length === 0 ? <div className={styles.empty}>Tidak ada</div> : calledTickets.map(ticket => {
              const session = ticket.visit?.journeySessions?.[0];
              const isCalled = session?.status === 'CALLED';
              const isServing = session?.status === 'SERVING';
              return (
                <div key={ticket.id} className={`${styles.queueCard} ${styles.activeCard}`}>
                  <div className={styles.ticketHeader}>
                    <span className={styles.ticketNo}>{ticket.ticketNo}</span>
                    <span className={`badge ${isCalled ? 'badge-warning' : 'badge-success'}`}>{isCalled ? 'DIPANGGIL' : 'DILAYANI'}</span>
                  </div>
                  <div className={styles.ticketInfo}>
                    <span>👨‍⚕️ {ticket.selectedDoctor?.doctorName || '-'}</span>
                    <span>🖥️ {session?.counter?.name || '-'}</span>
                    {ticket.visit?.patientName && <span>👤 {ticket.visit.patientName}</span>}
                    {ticket.visit?.patientRmNo && <span>📋 RM: {ticket.visit.patientRmNo}</span>}
                  </div>
                  <div className={styles.actionBtns}>
                    {isCalled && (
                      <>
                        <button className="btn btn-success btn-sm" onClick={() => startService(ticket.id)} disabled={actionLoading === ticket.id}>▶️ Mulai</button>
                        <button className="btn btn-warning btn-sm" onClick={() => callPatient(ticket.id)} disabled={actionLoading === ticket.id}>🔁 Ulang</button>
                      </>
                    )}
                    {isServing && (
                      <button className="btn btn-primary btn-sm" onClick={() => finishService(ticket)} disabled={actionLoading === ticket.id} style={{ flex: 1 }}>✅ Selesai</button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => openPatientModal(ticket)} title="Data Pasien">👤</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => openTimeModal(ticket)} title="Koreksi Waktu">⏱️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Patient Data Modal */}
      {patientModal && (
        <div className={styles.modalOverlay} onClick={() => setPatientModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>👤 Data Pasien — {patientModal.ticketNo}</h3>
            <div className="form-group"><label className="form-label">No. Rekam Medis</label><input className="form-input" value={patientForm.patientRmNo} onChange={e => setPatientForm({ ...patientForm, patientRmNo: e.target.value })} placeholder="Contoh: 000123" /></div>
            <div className="form-group"><label className="form-label">Nama Pasien</label><input className="form-input" value={patientForm.patientName} onChange={e => setPatientForm({ ...patientForm, patientName: e.target.value })} placeholder="Nama lengkap" /></div>
            <div className="form-group"><label className="form-label">Tanggal Lahir</label><input className="form-input" type="date" value={patientForm.patientDob} onChange={e => setPatientForm({ ...patientForm, patientDob: e.target.value })} /></div>
            <div className="form-group">
              <label className="form-label">Dokter Tujuan</label>
              <select className="form-select" value={patientForm.scheduleId} onChange={e => setPatientForm({ ...patientForm, scheduleId: e.target.value })}>
                <option value="">-- Pilih Dokter Tujuan --</option>
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>{s.doctor?.doctorName} - Poli {s.room?.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setPatientModal(null)}>Batal</button>
              <button className="btn btn-primary" onClick={savePatientData}>💾 Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Time Correction Modal */}
      {timeModal && (
        <div className={styles.modalOverlay} onClick={() => setTimeModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>⏱️ Koreksi Waktu — {timeModal.ticketNo}</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: 16 }}>Fitur &quot;Lupa klik&quot; — koreksi waktu jika operator terlambat menekan tombol.</p>
            <div className="form-group"><label className="form-label">Field yang dikoreksi</label>
              <select className="form-select" value={timeForm.field} onChange={e => setTimeForm({ ...timeForm, field: e.target.value })}>
                <option value="calledAt">Waktu Panggil</option>
                <option value="serviceStartedAt">Waktu Mulai Layani</option>
                <option value="serviceFinishedAt">Waktu Selesai</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Waktu Sebenarnya</label><input className="form-input" type="datetime-local" value={timeForm.correctedTime} onChange={e => setTimeForm({ ...timeForm, correctedTime: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Alasan Koreksi</label><input className="form-input" value={timeForm.reason} onChange={e => setTimeForm({ ...timeForm, reason: e.target.value })} placeholder="Contoh: Lupa klik tombol mulai" /></div>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setTimeModal(null)}>Batal</button>
              <button className="btn btn-warning" onClick={saveTimeCorrection}>⏱️ Koreksi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
