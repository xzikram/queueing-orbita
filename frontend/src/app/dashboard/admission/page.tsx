'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import styles from './admission.module.css';

interface Destination {
  unitType: string;
  label: string;
  icon: string;
  isDefault: boolean;
}

export default function AdmissionPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [selectedCounter, setSelectedCounter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // Patient data modal
  const [patientModal, setPatientModal] = useState<any>(null);
  const [patientForm, setPatientForm] = useState({ patientRmNo: '', patientName: '', scheduleId: '' });
  const [schedules, setSchedules] = useState<any[]>([]);
  // Time correction modal
  const [timeModal, setTimeModal] = useState<any>(null);
  const [timeForm, setTimeForm] = useState({ field: 'calledAt', correctedTime: '', reason: '' });
  // Destination modal (for finish service)
  const [destModal, setDestModal] = useState<any>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  // Transfer modal
  const [transferModal, setTransferModal] = useState<any>(null);
  const [transferReason, setTransferReason] = useState('');
  const [allDestinations, setAllDestinations] = useState<Destination[]>([]);

  const loadQueue = useCallback(async () => {
    try { const res = await api.get('/admission/queue'); setQueue(res.data); }
    catch (err) { console.error(err); }
  }, []);

  const loadCounters = useCallback(async () => {
    try {
      // Try to load assignment-based counters first
      const res = await api.get('/counter-assignment/admission-counters');
      const c = res.data.filter((c: any) => c.isActive);
      if (c.length > 0) {
        setCounters(c);
        setSelectedCounter(prev => c.find((x: any) => x.id === prev) ? prev : c[0].id);
        return;
      }
    } catch {}
    // Fallback: load all counters that can handle admission
    try {
      const res = await api.get('/counters');
      const c = res.data.filter((c: any) => c.canHandleAdmission && c.isActive);
      setCounters(c);
      if (c.length > 0) setSelectedCounter(c[0].id);
    } catch {}
  }, []);

  useEffect(() => {
    loadQueue();
    loadCounters();
    api.get('/schedules/active-today').then(res => {
      setSchedules(res.data);
    }).catch(() => {});
    // Load destinations for this unit
    api.get('/admission/destinations').then(res => {
      setDestinations(res.data);
      // All destinations for transfer (includes all units)
      setAllDestinations(res.data);
    }).catch(() => {});

    const socket = getSocket();
    socket.on('counterAssignmentUpdate', () => {
      loadCounters();
    });

    const interval = setInterval(loadQueue, 5000);
    return () => {
      clearInterval(interval);
      socket.off('counterAssignmentUpdate');
    };
  }, [loadQueue, loadCounters]);

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
    if (!ticket.visit?.patientRmNo || !ticket.visit?.selectedScheduleId) {
      alert('⚠️ Anda harus mengisi No. RM dan memilih Dokter Tujuan sebelum menyelesaikan layanan.');
      openPatientModal(ticket);
      return;
    }
    // Open destination modal to choose next unit
    setDestModal(ticket);
  };

  const confirmFinish = async (ticket: any, nextUnitType: string) => {
    setDestModal(null);
    setActionLoading(ticket.id);
    try {
      await api.post(`/admission/${ticket.id}/finish`, { nextUnitType });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
  };

  const openPatientModal = (ticket: any) => {
    const v = ticket.visit;
    setPatientForm({
      patientRmNo: v?.patientRmNo || '',
      patientName: v?.patientName || '',
      scheduleId: v?.selectedScheduleId || ticket.selectedScheduleId || '',
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

  const openTransferModal = (ticket: any) => {
    setTransferReason('');
    setTransferModal(ticket);
  };

  const confirmTransfer = async (ticket: any, targetUnitType: string) => {
    if (!transferReason.trim()) { alert('Masukkan alasan transfer'); return; }
    setTransferModal(null);
    setActionLoading(ticket.id);
    try {
      await api.post(`/admission/${ticket.id}/transfer`, {
        targetUnitType,
        reason: transferReason,
      });
      await loadQueue();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setActionLoading(null); }
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
                    <button className="btn btn-secondary btn-sm" onClick={() => openTransferModal(ticket)} title="Transfer Pasien" style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}>🔄</button>
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
            <div className="form-group"><label className="form-label">No. Rekam Medis *</label><input className="form-input" value={patientForm.patientRmNo} onChange={e => setPatientForm({ ...patientForm, patientRmNo: e.target.value })} placeholder="Wajib diisi (Contoh: 000123)" /></div>
            <div className="form-group"><label className="form-label">Nama Pasien (Opsional)</label><input className="form-input" value={patientForm.patientName} onChange={e => setPatientForm({ ...patientForm, patientName: e.target.value })} placeholder="Nama lengkap" /></div>
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

      {/* Destination Modal — Choose next unit after finishing admission */}
      {destModal && (
        <div className={styles.modalOverlay} onClick={() => setDestModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>🗺️ Tujuan Selanjutnya — {destModal.ticketNo}</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: 16 }}>Pilih unit tujuan pasien setelah admisi selesai.</p>
            <div className={styles.destGrid}>
              {destinations.map(dest => (
                <button
                  key={dest.unitType}
                  className={`${styles.destBtn} ${dest.isDefault ? styles.destDefault : ''}`}
                  onClick={() => confirmFinish(destModal, dest.unitType)}
                  style={dest.unitType === 'FINISHED' ? { gridColumn: '1 / -1' } : undefined}
                >
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
            <h3 className={styles.modalTitle}>🔄 Transfer Pasien — {transferModal.ticketNo}</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: 16 }}>Pindahkan pasien ke unit lain. Sesi saat ini akan ditandai sebagai TRANSFERRED.</p>
            <div className="form-group">
              <label className="form-label">Alasan Transfer *</label>
              <input className="form-input" value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="Contoh: Pasien langsung ke dokter, skip pengkajian" />
            </div>
            <div className={styles.destGrid}>
              {destinations.filter(d => d.unitType !== 'ADMISSION').map(dest => (
                <button
                  key={dest.unitType}
                  className={styles.destBtn}
                  onClick={() => confirmTransfer(transferModal, dest.unitType)}
                  style={dest.unitType === 'FINISHED' ? { gridColumn: '1 / -1' } : undefined}
                >
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
