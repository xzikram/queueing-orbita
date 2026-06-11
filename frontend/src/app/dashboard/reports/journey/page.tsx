'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import styles from './journey.module.css';

const UNIT_ICONS: Record<string, string> = {
  ADMISSION: '🏢', ASSESSMENT: '📋', BDR: '🏥',
  DOCTOR: '👨‍⚕️', CDC: '🔬', CASHIER: '💳',
  PHARMACY: '💊', OPTIC: '👓',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  WAITING: { label: 'Menunggu', color: '#f59e0b' },
  CALLED: { label: 'Dipanggil', color: '#8b5cf6' },
  SERVING: { label: 'Dilayani', color: '#3b82f6' },
  FINISHED: { label: 'Selesai', color: '#10b981' },
  CANCELLED: { label: 'Dibatalkan', color: '#ef4444' },
  TRANSFERRED: { label: 'Ditransfer', color: '#f97316' },
};

const formatDuration = (seconds: number | null) => {
  if (!seconds || seconds <= 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}j ${m}m ${s}d`;
  if (m > 0) return `${m}m ${s}d`;
  return `${s}d`;
};

const formatTime = (dt: string | null) => {
  if (!dt) return '-';
  return new Date(dt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const getLocalDateString = (offsetDays = 0) => {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function PatientJourneyPage() {
  const [data, setData] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState(() => getLocalDateString());
  const [endDate, setEndDate] = useState(() => getLocalDateString());
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/patient-journey', {
        params: { startDate, endDate, search: search || undefined, status: statusFilter || undefined, page, limit: 30 },
      });
      setData(res.data.data);
      setMeta(res.data.meta);
    } catch (err) {
      console.error('Failed to fetch journey data', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, search, statusFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpand = (visitId: string) => {
    setExpandedVisit(prev => prev === visitId ? null : visitId);
  };

  const handleExportExcel = async () => {
    try {
      const res = await api.get('/reports/export-patient-journey', {
        params: { startDate, endDate, search: search || undefined, status: statusFilter || undefined },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tracking_Pasien_${startDate}_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      alert('Gagal export data Excel');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>🔍 Tracking Perjalanan Pasien</h1>
            <p>Lacak perjalanan lengkap setiap pasien dari datang hingga pulang</p>
          </div>
          <button className="btn btn-primary" onClick={handleExportExcel}>
            📥 Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filterRow}>
        <div className={styles.filterGroup}>
          <label>Dari</label>
          <input type="date" className="form-input" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} />
        </div>
        <div className={styles.filterGroup}>
          <label>Sampai</label>
          <input type="date" className="form-input" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} />
        </div>
        <div className={styles.filterGroup}>
          <label>Cari</label>
          <input type="text" className="form-input" placeholder="No. Tiket / RM / Nama..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className={styles.filterGroup}>
          <label>Status</label>
          <select className="form-input" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Semua</option>
            <option value="active">Masih Aktif</option>
            <option value="finished">Sudah Selesai</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className={styles.resultInfo}>
        Menampilkan {data.length} dari {meta.total} kunjungan
      </div>

      {/* Journey List */}
      <div className={styles.journeyList}>
        {loading ? (
          <div className={styles.loading}>Memuat data perjalanan pasien...</div>
        ) : data.length === 0 ? (
          <div className={styles.empty}>Tidak ada data kunjungan untuk periode ini.</div>
        ) : (
          data.map((visit: any) => (
            <div key={visit.visitId} className={`${styles.journeyCard} ${visit.finishedAt ? styles.journeyFinished : styles.journeyActive}`}>
              {/* Card Header */}
              <div className={styles.cardHeader} onClick={() => toggleExpand(visit.visitId)}>
                <div className={styles.cardLeft}>
                  <span className={styles.ticketNo}>{visit.ticketNo}</span>
                  {visit.doctorTicketNo && <span className={styles.doctorTicket}>{visit.doctorTicketNo}</span>}
                  <span className={`${styles.statusBadge} ${visit.finishedAt ? styles.badgeFinished : styles.badgeActive}`}>
                    {visit.finishedAt ? '✅ Selesai' : `🔄 ${visit.currentStatus || 'Aktif'}`}
                  </span>
                </div>
                <div className={styles.cardCenter}>
                  {visit.patientName && <span className={styles.patientName}>👤 {visit.patientName}</span>}
                  {visit.patientRmNo && <span className={styles.rmNo}>RM: {visit.patientRmNo}</span>}
                  {visit.doctorName && <span className={styles.doctorInfo}>👨‍⚕️ {visit.doctorName}</span>}
                </div>
                <div className={styles.cardRight}>
                  <div className={styles.totalTime}>
                    <span className={styles.totalLabel}>Total Waktu</span>
                    <span className={styles.totalValue}>{formatDuration(visit.totalJourneySeconds)}</span>
                  </div>
                  <span className={styles.expandIcon}>{expandedVisit === visit.visitId ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Journey Steps Mini Timeline */}
              <div className={styles.miniTimeline}>
                {visit.steps.map((step: any, idx: number) => (
                  <div key={idx} className={styles.miniStep}>
                    <div className={`${styles.miniDot} ${step.status === 'FINISHED' ? styles.dotDone : step.status === 'SERVING' || step.status === 'CALLED' ? styles.dotActive : styles.dotWaiting}`} />
                    <span className={styles.miniLabel}>{UNIT_ICONS[step.unitType]} {step.unitLabel}</span>
                    {idx < visit.steps.length - 1 && <div className={`${styles.miniLine} ${step.status === 'FINISHED' ? styles.lineDone : ''}`} />}
                  </div>
                ))}
              </div>

              {/* Expanded Detail */}
              {expandedVisit === visit.visitId && (
                <div className={styles.expandedDetail}>
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>Unit</th>
                        <th>Ruangan</th>
                        <th>Status</th>
                        <th>Mulai Tunggu</th>
                        <th>Dipanggil</th>
                        <th>Mulai Layanan</th>
                        <th>Selesai</th>
                        <th>Waktu Tunggu</th>
                        <th>Waktu Layanan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visit.steps.map((step: any, idx: number) => {
                        const st = STATUS_LABELS[step.status] || { label: step.status, color: '#94a3b8' };
                        return (
                          <tr key={idx}>
                            <td><strong>{UNIT_ICONS[step.unitType]} {step.unitLabel}</strong></td>
                            <td>{step.roomName || step.counterName || step.floorName || '-'}</td>
                            <td><span style={{ color: st.color, fontWeight: 600 }}>{st.label}</span></td>
                            <td>{formatTime(step.waitingStartedAt)}</td>
                            <td>{formatTime(step.calledAt)}</td>
                            <td>{formatTime(step.serviceStartedAt)}</td>
                            <td>{formatTime(step.serviceFinishedAt)}</td>
                            <td className={styles.durationCell}>{formatDuration(step.waitingDurationSeconds)}</td>
                            <td className={styles.durationCell}>{formatDuration(step.serviceDurationSeconds)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className={styles.summaryRow}>
                    <span>📅 Tanggal: {new Date(visit.visitDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span>⏰ Datang: {visit.journeyStartTime ? formatTime(visit.journeyStartTime) : '-'}</span>
                    <span>🏁 Selesai: {visit.journeyEndTime ? formatTime(visit.journeyEndTime) : 'Masih aktif'}</span>
                    <span>⏱️ Total: <strong>{formatDuration(visit.totalJourneySeconds)}</strong></span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className={styles.pagination}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Sebelumnya</button>
          <span className={styles.pageInfo}>Halaman {meta.page} dari {meta.totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>Selanjutnya →</button>
        </div>
      )}
    </div>
  );
}
