'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../master/master.module.css';

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0,10));
  const [importFile, setImportFile] = useState<File|null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/schedules?date=${filterDate}`);
      setSchedules(Array.isArray(res.data) ? res.data : []);
    } catch(err) { console.error(err); }
  }, [filterDate]);

  const loadHistory = async () => {
    try { const res = await api.get('/schedules/import-history'); setImportHistory(res.data); }
    catch(err) { console.error(err); }
  };

  const formatTime = (t: string) => {
    if (!t) return '';
    if (t.includes('GMT')) {
      const d = new Date(t);
      if (!isNaN(d.getTime())) return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return t;
  };

  useEffect(() => { load(); }, [load]);

  const doImport = async () => {
    if (!importFile) return;
    setUploading(true); setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await api.post('/schedules/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(res.data);
      setImportFile(null);
      await load();
    } catch(e:any) { alert(e.response?.data?.message || 'Gagal import'); }
    finally { setUploading(false); }
  };

  const downloadTemplate = () => { window.open(`${api.defaults.baseURL}/schedules/template`, '_blank'); };

  const removeAll = async () => {
    if(!confirm('Peringatan: Aksi ini akan menghapus SEMUA jadwal dokter secara permanen. Lanjutkan?')) return;
    try {
      await api.delete('/schedules/all');
      await load();
      alert('Semua jadwal berhasil dihapus');
    } catch(e:any) {
      alert(e.response?.data?.message || 'Gagal menghapus jadwal');
    }
  };

  return (
    <div className={styles.masterPage}>
      {/* Toolbar */}
      <div className={`glass-card ${styles.toolbar}`}>
        <div className={styles.toolbarLeft}>
          <input type="date" className="form-input" style={{width:180}} value={filterDate} onChange={e=>setFilterDate(e.target.value)} />
          <span style={{color:'var(--gray-400)',fontSize:'0.875rem'}}>{schedules.length} jadwal</span>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" onClick={()=>{setShowImport(!showImport);loadHistory();}}>📥 Import Excel</button>
          <button className="btn btn-secondary" onClick={downloadTemplate}>📋 Template</button>
          <button className="btn btn-danger" onClick={removeAll}>🗑️ Hapus Semua</button>
        </div>
      </div>

      {/* Import Panel */}
      {showImport && (
        <div className="glass-card" style={{padding:20}}>
          <h3 style={{color:'var(--gray-200)',fontWeight:600,marginBottom:16}}>Import Jadwal dari Excel</h3>
          <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:16}}>
            <input type="file" accept=".xlsx,.xls" onChange={e=>setImportFile(e.target.files?.[0]||null)} style={{color:'var(--gray-300)'}} />
            <button className="btn btn-primary" onClick={doImport} disabled={!importFile||uploading}>{uploading?'Mengupload...':'Upload & Import'}</button>
          </div>
          {importResult && (
            <div style={{padding:16,background:'var(--bg-glass)',borderRadius:'var(--radius-md)',border:'1px solid var(--border-color)'}}>
              <p style={{color:'var(--gray-200)'}}>Total: {importResult.total} | <span style={{color:'var(--success)'}}>✅ {importResult.success}</span> | <span style={{color:'var(--error)'}}>❌ {importResult.failed}</span></p>
              {importResult.errors?.length > 0 && (
                <div style={{marginTop:8,maxHeight:200,overflow:'auto',fontSize:'0.8125rem',color:'var(--error)'}}>
                  {importResult.errors.map((e:string,i:number) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
          {importHistory.length > 0 && (
            <div style={{marginTop:16}}>
              <h4 style={{color:'var(--gray-300)',fontSize:'0.875rem',marginBottom:8}}>Riwayat Import</h4>
              <table className="data-table"><thead><tr><th>File</th><th>Total</th><th>✅</th><th>❌</th><th>Status</th><th>Waktu</th></tr></thead>
              <tbody>{importHistory.map(h=>(
                <tr key={h.id}><td>{h.filename}</td><td>{h.totalRows}</td><td style={{color:'var(--success)'}}>{h.successRows}</td><td style={{color:'var(--error)'}}>{h.failedRows}</td><td><span className={`badge ${h.status==='COMPLETED'?'badge-success':'badge-danger'}`}>{h.status}</span></td><td>{new Date(h.createdAt).toLocaleString('id-ID')}</td></tr>
              ))}</tbody></table>
            </div>
          )}
        </div>
      )}

      {/* Schedule Table */}
      <div className={`glass-card ${styles.tableCard}`}><div className={styles.tableWrap}>
        <table className="data-table"><thead><tr><th>Tanggal</th><th>Hari</th><th>Dokter</th><th>Ruangan</th><th>Lantai</th><th>Jam</th><th>Status</th></tr></thead>
        <tbody>{schedules.map((s:any)=>(
          <tr key={s.id}>
            <td>{new Date(s.scheduleDate).toLocaleDateString('id-ID')}</td>
            <td>{s.dayName}</td>
            <td><strong>{s.doctor?.doctorName}</strong></td>
            <td>{s.room?.name}</td>
            <td>{s.floor?.name}</td>
            <td>{formatTime(s.startTime)} - {formatTime(s.endTime)}</td>
            <td><span className={`badge ${s.status==='ACTIVE'?'badge-success':'badge-danger'}`}>{s.status}</span></td>
          </tr>
        ))}</tbody></table>
      </div></div>
    </div>
  );
}
