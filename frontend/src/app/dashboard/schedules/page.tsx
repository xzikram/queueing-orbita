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
  const [showHistory, setShowHistory] = useState(false);
  
  // Manual form states
  const [showForm, setShowForm] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  const [showDocDropdown, setShowDocDropdown] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    scheduleDate: new Date().toISOString().slice(0,10),
    doctorId: '',
    roomId: '',
    floorId: '',
    startTime: '08:00',
    endTime: '12:00',
  });

  const loadMasterData = async () => {
    try {
      const [docRes, rmRes] = await Promise.all([
        api.get('/doctors'),
        api.get('/rooms')
      ]);
      setDoctors(docRes.data);
      setRooms(rmRes.data);
    } catch(err) { console.error(err); }
  };

  useEffect(() => {
    if (showForm && doctors.length === 0) {
      loadMasterData();
    }
  }, [showForm]);

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

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.doctorId || !formData.roomId) return alert('Pilih dokter dan ruangan!');
    try {
      const dateObj = new Date(formData.scheduleDate);
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = days[dateObj.getDay()];
      
      const payload = {
        ...formData,
        dayName,
        quota: 999
      };
      await api.post('/schedules', payload);
      setShowForm(false);
      setFormData({
        scheduleDate: new Date().toISOString().slice(0,10),
        doctorId: '', roomId: '', floorId: '', startTime: '08:00', endTime: '12:00'
      });
      setDocSearch('');
      load();
    } catch(err:any) {
      alert(err.response?.data?.message || 'Gagal menyimpan jadwal');
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
          <button className="btn btn-primary" onClick={()=>setShowForm(true)}>➕ Tambah Manual</button>
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

          <div style={{marginTop:16}}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Sembunyikan Riwayat' : 'Tampilkan Riwayat'}
            </button>
          </div>

          {showHistory && importHistory.length > 0 && (
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

      {/* Manual Form Modal */}
      {showForm && (
        <div className={styles.modalOverlay} onClick={()=>setShowForm(false)}>
          <div className={styles.modal} onClick={e=>e.stopPropagation()} style={{maxWidth: 500}}>
            <h3 className={styles.modalTitle}>Tambah Jadwal Manual</h3>
            <form onSubmit={submitManual} className={styles.modalForm}>
              <div className="form-group">
                <label className="form-label">Tanggal</label>
                <input type="date" className="form-input" required value={formData.scheduleDate} onChange={e=>setFormData({...formData, scheduleDate: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Dokter</label>
                <div style={{position:'relative'}} onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowDocDropdown(false);
                }}>
                  <input 
                    type="text"
                    className="form-input" 
                    placeholder="Ketik nama dokter..."
                    required
                    value={docSearch} 
                    onFocus={() => setShowDocDropdown(true)}
                    onChange={e => {
                      setDocSearch(e.target.value);
                      setShowDocDropdown(true);
                      const val = e.target.value.toLowerCase();
                      const exactMatch = doctors.find(doc => doc.doctorName.toLowerCase() === val || doc.doctorCode?.toLowerCase() === val);
                      if(exactMatch) {
                        setFormData({...formData, doctorId: exactMatch.id, roomId: exactMatch.defaultRoomId || '', floorId: exactMatch.defaultRoom?.floorId || ''});
                      } else {
                        setFormData({...formData, doctorId: '', roomId: '', floorId: ''});
                      }
                    }}
                  />
                  {showDocDropdown && docSearch.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                      background: '#fff', border: '1px solid #ccc', 
                      borderRadius: '8px', zIndex: 50, maxHeight: 200, overflowY: 'auto',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                      {doctors.filter(d => d.doctorName.toLowerCase().includes(docSearch.toLowerCase()) || d.doctorCode?.toLowerCase().includes(docSearch.toLowerCase())).map(d => (
                        <div 
                          key={d.id} 
                          tabIndex={0}
                          style={{padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #eee', color: '#333'}}
                          onMouseDown={(e) => e.preventDefault()} // Prevent blur before onClick fires
                          onClick={() => {
                            setDocSearch(`${d.doctorCode} - ${d.doctorName}`);
                            setFormData({...formData, doctorId: d.id, roomId: d.defaultRoomId || '', floorId: d.defaultRoom?.floorId || ''});
                            setShowDocDropdown(false);
                          }}
                        >
                          {d.doctorCode} - {d.doctorName}
                        </div>
                      ))}
                      {doctors.filter(d => d.doctorName.toLowerCase().includes(docSearch.toLowerCase()) || d.doctorCode?.toLowerCase().includes(docSearch.toLowerCase())).length === 0 && (
                        <div style={{padding: '8px 12px', color: '#999', fontStyle: 'italic'}}>Dokter tidak ditemukan</div>
                      )}
                    </div>
                  )}
              </div>
              <div className="form-group">
                <label className="form-label">Ruangan</label>
                <select 
                  className="form-input" 
                  required
                  value={formData.roomId} 
                  onChange={e => {
                    const r = rooms.find(rm => rm.id === e.target.value);
                    setFormData({...formData, roomId: e.target.value, floorId: r?.floorId || ''});
                  }}
                >
                  <option value="">-- Pilih Ruangan --</option>
                  {rooms.map(rm => (
                    <option key={rm.id} value={rm.id}>{rm.name} (Lt. {rm.floor?.name || rm.floor?.floorNumber})</option>
                  ))}
                </select>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 16}}>
                <div className="form-group">
                  <label className="form-label">Jam Mulai</label>
                  <input type="time" className="form-input" required value={formData.startTime} onChange={e=>setFormData({...formData, startTime: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Jam Selesai</label>
                  <input type="time" className="form-input" required value={formData.endTime} onChange={e=>setFormData({...formData, endTime: e.target.value})} />
                </div>
              </div>
              
              <div className={styles.modalActions}>
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={!formData.roomId}>Simpan</button>
              </div>
            </form>
          </div>
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
