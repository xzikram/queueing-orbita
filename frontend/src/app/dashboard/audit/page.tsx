'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import styles from './audit.module.css';

const UNITS = [
  { id: '', label: 'Semua Unit' },
  { id: 'ADMISSION', label: 'Admisi' },
  { id: 'CASHIER', label: 'Kasir' },
  { id: 'PHARMACY', label: 'Farmasi' },
  { id: 'DOCTOR', label: 'Poli/Dokter' },
  { id: 'ASSESSMENT', label: 'Pengkajian' },
  { id: 'BDR', label: 'BDR' },
  { id: 'CDC', label: 'CDC' },
];

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

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [unitType, setUnitType] = useState('');
  const [startDate, setStartDate] = useState(() => getLocalDateString(-1));
  const [endDate, setEndDate] = useState(() => getLocalDateString());
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        search: search || undefined,
        unitType: unitType || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit: 50,
      };
      const res = await api.get('/audit', { params });
      setLogs(res.data.data);
      setTotalPages(res.data.meta.totalPages);
    } catch (error) {
      console.error('Failed to fetch audit logs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, unitType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>🛡️ Audit Logs</h1>
          <p>Riwayat aktivitas pengguna pada sistem</p>
        </div>
      </div>

      <div className={`glass-card ${styles.filterCard}`}>
        <form onSubmit={handleSearch} className={styles.filterForm}>
          <div className="form-group mb-0" style={{ flex: 2 }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Pencarian (Nama/Tiket/Aksi)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Cari nama pasien, tiket, atau petugas..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <div className="form-group mb-0" style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Unit</label>
            <select className="form-select" value={unitType} onChange={(e) => setUnitType(e.target.value)}>
              {UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
          <div className="form-group mb-0" style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Dari Tanggal</label>
            <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group mb-0" style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Sampai Tanggal</label>
            <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', height: '42px' }}>
            🔍 Cari
          </button>
        </form>
      </div>

      <div className={`glass-card ${styles.tableCard}`}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Petugas</th>
                <th>Aksi</th>
                <th>Pasien / Tiket</th>
                <th>Unit</th>
                <th>Catatan API</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Memuat data...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>Tidak ada log aktivitas ditemukan.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td className={styles.timeCell}>
                      <div className={styles.dateText}>{new Date(log.timestamp).toLocaleDateString('id-ID')}</div>
                      <div className={styles.timeText}>{new Date(log.timestamp).toLocaleTimeString('id-ID')}</div>
                    </td>
                    <td>
                      <div className={styles.userName}>{log.userName || log.userId}</div>
                    </td>
                    <td>
                      <div className={styles.actionText}>{log.humanDescription || `Aksi ${log.action} pada ${log.entity}`}</div>
                    </td>
                    <td>
                      {log.patientName && <div className={styles.patientName}>👤 {log.patientName}</div>}
                      {log.ticketNo && <div className={styles.ticketNo}>🎫 {log.ticketNo}</div>}
                      {!log.patientName && !log.ticketNo && <span style={{ color: '#94a3b8' }}>-</span>}
                    </td>
                    <td>
                      {log.unitType ? <span className={styles.badgeInfo}>{log.unitType}</span> : <span style={{ color: '#94a3b8' }}>-</span>}
                    </td>
                    <td className={styles.techNotes}>
                      <span className={styles.methodBadge}>{log.action}</span> /{log.entity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="btn btn-secondary btn-sm"
            >
              &laquo; Prev
            </button>
            <span className={styles.pageInfo}>Halaman {page} dari {totalPages}</span>
            <button 
              disabled={page >= totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="btn btn-secondary btn-sm"
            >
              Next &raquo;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
