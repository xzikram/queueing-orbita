'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import styles from '../reports/reports.module.css'; // Reuse table styles

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        action: action || undefined,
        entity: entity || undefined,
        page,
        limit: 50,
      };
      const res = await api.get('/audit', { params });
      setLogs(res.data.data);
      setTotalPages(res.data.meta.totalPages);
    } catch (error) {
      console.error('Failed to fetch audit logs', error);
      alert('Gagal memuat audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>System Audit Logs</h1>
      </div>

      <div className={styles.filterCard}>
        <div className={styles.filterGroup}>
          <label>Tipe Aksi (Method)</label>
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Semua Aksi</option>
            <option value="POST">CREATE (POST)</option>
            <option value="PUT">UPDATE (PUT)</option>
            <option value="PATCH">UPDATE (PATCH)</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label>Entitas / Modul</label>
          <input 
            type="text" 
            placeholder="e.g. admission, users" 
            value={entity} 
            onChange={(e) => setEntity(e.target.value)} 
          />
        </div>
        <button onClick={() => { setPage(1); fetchLogs(); }} className={styles.btnFilter} disabled={loading}>
          {loading ? 'Memuat...' : 'Cari Log'}
        </button>
      </div>

      <div className={styles.tableCard}>
        <h3>Rekaman Aktivitas</h3>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Waktu (Timestamp)</th>
              <th>User ID</th>
              <th>Aksi</th>
              <th>Entitas</th>
              <th>Data Baru (Payload)</th>
              <th>Alasan/Note</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>{new Date(log.timestamp).toLocaleString('id-ID')}</td>
                <td>{log.userId}</td>
                <td>
                  <span className={`badge ${log.action === 'DELETE' ? 'badge-danger' : log.action === 'POST' ? 'badge-success' : 'badge-primary'}`}>
                    {log.action}
                  </span>
                </td>
                <td>{log.entity}</td>
                <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.newValue}
                </td>
                <td>{log.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', alignItems: 'center' }}>
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
          >
            &laquo; Prev
          </button>
          <span>Halaman {page} dari {totalPages || 1}</span>
          <button 
            disabled={page >= totalPages} 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Next &raquo;
          </button>
        </div>
      </div>
    </div>
  );
}
