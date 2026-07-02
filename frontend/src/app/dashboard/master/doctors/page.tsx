'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../master.module.css';

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create'|'edit'|'delete'|null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({doctorCode:'',doctorName:'',doctorInitials:'',defaultRoomId:'',isActive:true});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [d,r] = await Promise.all([api.get('/doctors'),api.get('/rooms')]);
    setDoctors(d.data); setRooms(r.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({doctorCode:'',doctorName:'',doctorInitials:'',defaultRoomId:'',isActive:true}); setModal('create'); };
  const openEdit = (d:any) => { setSelected(d); setForm({doctorCode:d.doctorCode,doctorName:d.doctorName,doctorInitials:d.doctorInitials||'',defaultRoomId:d.defaultRoomId||'',isActive:d.isActive}); setModal('edit'); };

  const save = async () => {
    setLoading(true);
    try {
      const data = {
        doctorCode: form.doctorCode,
        doctorName: form.doctorName,
        doctorInitials: form.doctorInitials || null,
        defaultRoomId: form.defaultRoomId || null,
        isActive: form.isActive,
        specialty: '-'
      };
      modal==='create' ? await api.post('/doctors',data) : await api.put(`/doctors/${selected.id}`,data);
      setModal(null); await load();
    } catch(e:any){alert(e.response?.data?.message||'Gagal');}
    finally{setLoading(false);}
  };
  const remove = async () => { setLoading(true); try{await api.delete(`/doctors/${selected.id}`);setModal(null);await load();}catch(e:any){alert(e.response?.data?.message||'Gagal');}finally{setLoading(false);} };
  
  const removeAll = async () => {
    if(!confirm('Peringatan: Aksi ini akan menghapus semua dokter dan semua jadwal mereka. Lanjutkan?')) return;
    setLoading(true);
    try {
      await api.delete('/doctors/all');
      await load();
      alert('Semua data dokter berhasil dihapus');
    } catch(e:any) {
      alert(e.response?.data?.message || 'Gagal menghapus');
    } finally {
      setLoading(false);
    }
  };

  const filtered = doctors.filter(d => d.doctorName.toLowerCase().includes(search.toLowerCase()) || d.doctorCode.toLowerCase().includes(search.toLowerCase()));

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/doctors/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-master-dokter.xlsx';
      a.click();
    } catch (e: any) {
      alert('Gagal mendownload template: ' + (e.response?.data?.message || e.message || 'Unknown error'));
    }
  };

  const handleImport = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/doctors/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert(`Import Selesai!\nSukses: ${res.data.success}\nGagal: ${res.data.failed}\nTotal: ${res.data.total}`);
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal import');
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className={styles.masterPage}>
      <div className={`glass-card ${styles.toolbar}`}>
        <input className={styles.searchInput} placeholder="Cari dokter..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleDownloadTemplate}>⬇️ Template</button>
          <label className="btn btn-warning" style={{ cursor: 'pointer', margin: 0 }}>
            ⬆️ Import Excel
            <input type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} disabled={loading} />
          </label>
          <button className="btn btn-primary" onClick={openCreate}>+ Tambah Dokter</button>
          <button className="btn btn-danger" onClick={removeAll} disabled={loading}>🗑️ Hapus Semua</button>
        </div>
      </div>
      <div className={`glass-card ${styles.tableCard}`}><div className={styles.tableWrap}>
        <table className="data-table"><thead><tr><th>Kode/Singkatan</th><th>Nama Dokter</th><th>Ruangan Default</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>{filtered.map(d=>(
          <tr key={d.id}>
            <td><code style={{color:'var(--primary-300)'}}>{d.doctorCode}{d.doctorInitials ? ` / ${d.doctorInitials}` : ''}</code></td>
            <td><strong>{d.doctorName}</strong></td>
            <td>{d.defaultRoom ? `${d.defaultRoom.name} (${d.defaultRoom.code})` : '-'}</td>
            <td><span className={styles.statusDot+' '+(d.isActive?styles.statusActive:styles.statusInactive)}/>{d.isActive?'Aktif':'Nonaktif'}</td>
            <td><div style={{display:'flex',gap:6}}><button className="btn btn-secondary btn-sm" onClick={()=>openEdit(d)}>Edit</button><button className="btn btn-danger btn-sm" onClick={()=>{setSelected(d);setModal('delete')}}>Hapus</button></div></td>
          </tr>
        ))}</tbody></table>
      </div></div>

      {(modal==='create'||modal==='edit')&&<div className={styles.modalOverlay} onClick={()=>setModal(null)}><div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <h3 className={styles.modalTitle}>{modal==='create'?'Tambah':'Edit'} Dokter</h3>
        <div className="form-group"><label className="form-label">Kode HIS (Paramedic ID)</label><input className="form-input" value={form.doctorCode} onChange={e=>setForm({...form,doctorCode:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Singkatan (Inisial)</label><input className="form-input" value={form.doctorInitials} onChange={e=>setForm({...form,doctorInitials:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Nama Dokter</label><input className="form-input" value={form.doctorName} onChange={e=>setForm({...form,doctorName:e.target.value})}/></div>
        <div className="form-group">
          <label className="form-label">Ruangan Default</label>
          <select 
            className="form-input" 
            value={form.defaultRoomId} 
            onChange={e=>setForm({...form,defaultRoomId:e.target.value})}
          >
            <option value="">-- Tanpa Ruangan Default --</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name} (Lt. {r.floor?.name || r.floor?.floorNumber})</option>
            ))}
          </select>
        </div>
        <div className={styles.modalActions}><button className="btn btn-secondary" onClick={()=>setModal(null)}>Batal</button><button className="btn btn-primary" onClick={save} disabled={loading}>{loading?'...':'Simpan'}</button></div>
      </div></div>}

      {modal==='delete'&&<div className={styles.modalOverlay} onClick={()=>setModal(null)}><div className={styles.modal} onClick={e=>e.stopPropagation()}><div className={styles.deleteConfirm}><h3 className={styles.modalTitle}>Hapus Dokter</h3><p>Yakin hapus <strong>{selected?.doctorName}</strong>?</p><div className={styles.modalActions} style={{justifyContent:'center'}}><button className="btn btn-secondary" onClick={()=>setModal(null)}>Batal</button><button className="btn btn-danger" onClick={remove} disabled={loading}>{loading?'...':'Hapus'}</button></div></div></div></div>}
    </div>
  );
}
