'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../master.module.css';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [displays, setDisplays] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create'|'edit'|'delete'|null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({code:'',name:'',roomType:'DOCTOR',floorId:'',displayId:'',hasCalling:true,isActive:true});
  const [loading, setLoading] = useState(false);
  
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const types = ['BDR','DOCTOR','DOCTOR_CHILD','CDC','ADMISSION','CASHIER','PHARMACY','OPTIC'];

  const load = useCallback(async () => {
    const [r,f,d] = await Promise.all([api.get('/rooms'),api.get('/floors'),api.get('/displays')]);
    setRooms(r.data); setFloors(f.data); setDisplays(d.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({code:'',name:'',roomType:'DOCTOR',floorId:floors[0]?.id||'',displayId:'',hasCalling:true,isActive:true}); setModal('create'); };
  const openEdit = (r:any) => { setSelected(r); setForm({code:r.code,name:r.name,roomType:r.roomType,floorId:r.floorId,displayId:r.displayId||'',hasCalling:r.hasCalling,isActive:r.isActive}); setModal('edit'); };

  const save = async () => {
    setLoading(true);
    try {
      const d = {...form, displayId: form.displayId||null};
      modal==='create' ? await api.post('/rooms',d) : await api.put(`/rooms/${selected.id}`,d);
      setModal(null); await load();
    } catch(e:any){alert(e.response?.data?.message||'Gagal');}
    finally{setLoading(false);}
  };
  
  const remove = async () => { setLoading(true); try{await api.delete(`/rooms/${selected.id}`);setModal(null);await load();}catch(e:any){alert(e.response?.data?.message||'Gagal');}finally{setLoading(false);} };

  const downloadTemplate = () => {
    window.open(`${api.defaults.baseURL}/rooms/template`, '_blank');
  };

  const doImport = async () => {
    if (!importFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await api.post('/rooms/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      alert(`Import sukses! Total: ${res.data?.total}, Sukses: ${res.data?.success}, Gagal: ${res.data?.failed}`);
      setImportFile(null);
      setShowImport(false);
      await load();
    } catch(e:any) {
      alert(e.response?.data?.message || 'Gagal import');
    } finally {
      setUploading(false);
    }
  };

  const generateDefaultRooms = async () => {
    if (!confirm('Aksi ini akan men-generate ruangan default Lantai 5 (A1-501 sd A1-526) dan Lantai 6 (A1-601 sd A1-626). Lanjutkan?')) return;
    setGenerating(true);
    try {
      const res = await api.post('/rooms/import-default');
      alert(`Berhasil men-generate ${res.data?.success || 0} ruangan default.`);
      await load();
    } catch(e:any) {
      alert(e.response?.data?.message || 'Gagal generate');
    } finally {
      setGenerating(false);
    }
  };

  const removeAll = async () => {
    if (!confirm('PERINGATAN: Aksi ini akan menghapus SEMUA ruangan beserta data jadwal dokter yang terkait secara permanen! Lanjutkan?')) return;
    setLoading(true);
    try {
      await api.delete('/rooms/all');
      await load();
      alert('Semua ruangan berhasil dihapus');
    } catch(e:any) {
      alert(e.response?.data?.message || 'Gagal menghapus ruangan');
    } finally {
      setLoading(false);
    }
  };

  const filtered = rooms.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={styles.masterPage}>
      {/* Toolbar */}
      <div className={`glass-card ${styles.toolbar}`}>
        <input className={styles.searchInput} placeholder="Cari ruangan..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-primary" onClick={openCreate}>+ Tambah Ruangan</button>
          <button className="btn btn-secondary" onClick={()=>setShowImport(!showImport)}>📥 Import Excel</button>
          <button className="btn btn-secondary" onClick={downloadTemplate}>📋 Template</button>
          <button className="btn btn-secondary" onClick={generateDefaultRooms} disabled={generating}>{generating ? 'Memproses...' : '🔄 Generate Default'}</button>
          <button className="btn btn-danger" onClick={removeAll}>🗑️ Hapus Semua</button>
        </div>
      </div>

      {/* Import Panel */}
      {showImport && (
        <div className="glass-card" style={{padding:20, marginBottom: 16}}>
          <h3 style={{color:'var(--gray-200)',fontWeight:600,marginBottom:16}}>Import Ruangan dari Excel</h3>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <input type="file" accept=".xlsx,.xls" onChange={e=>setImportFile(e.target.files?.[0]||null)} style={{color:'var(--gray-300)'}} />
            <button className="btn btn-primary" onClick={doImport} disabled={!importFile||uploading}>{uploading?'Mengupload...':'Upload & Import'}</button>
          </div>
        </div>
      )}

      <div className={`glass-card ${styles.tableCard}`}><div className={styles.tableWrap}>
        <table className="data-table"><thead><tr><th>Kode</th><th>Nama</th><th>Tipe</th><th>Lantai</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>{filtered.map(r=>(
          <tr key={r.id}><td><code style={{color:'var(--primary-300)'}}>{r.code}</code></td><td><strong>{r.name}</strong></td><td><span className="badge badge-info">{r.roomType}</span></td><td>{r.floor?.name||'-'}</td><td><span className={styles.statusDot+' '+(r.isActive?styles.statusActive:styles.statusInactive)}/>{r.isActive?'Aktif':'Nonaktif'}</td>
          <td><div style={{display:'flex',gap:6}}><button className="btn btn-secondary btn-sm" onClick={()=>openEdit(r)}>Edit</button><button className="btn btn-danger btn-sm" onClick={()=>{setSelected(r);setModal('delete')}}>Hapus</button></div></td></tr>
        ))}</tbody></table>
      </div></div>

      {(modal==='create'||modal==='edit')&&<div className={styles.modalOverlay} onClick={()=>setModal(null)}><div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <h3 className={styles.modalTitle}>{modal==='create'?'Tambah':'Edit'} Ruangan</h3>
        <div className="form-group"><label className="form-label">Kode</label><input className="form-input" value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Nama</label><input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Tipe</label><select className="form-select" value={form.roomType} onChange={e=>setForm({...form,roomType:e.target.value})}>{types.map(t=><option key={t}>{t}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Lantai</label><select className="form-select" value={form.floorId} onChange={e=>setForm({...form,floorId:e.target.value})}>{floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
        <div className={styles.modalActions}><button className="btn btn-secondary" onClick={()=>setModal(null)}>Batal</button><button className="btn btn-primary" onClick={save} disabled={loading}>{loading?'...':'Simpan'}</button></div>
      </div></div>}

      {modal==='delete'&&<div className={styles.modalOverlay} onClick={()=>setModal(null)}><div className={styles.modal} onClick={e=>e.stopPropagation()}><div className={styles.deleteConfirm}><h3 className={styles.modalTitle}>Hapus Ruangan</h3><p>Yakin hapus <strong>{selected?.name}</strong>?</p><div className={styles.modalActions} style={{justifyContent:'center'}}><button className="btn btn-secondary" onClick={()=>setModal(null)}>Batal</button><button className="btn btn-danger" onClick={remove} disabled={loading}>{loading?'...':'Hapus'}</button></div></div></div></div>}
    </div>
  );
}
