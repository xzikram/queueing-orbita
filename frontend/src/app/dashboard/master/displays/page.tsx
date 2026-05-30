'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../master.module.css';

export default function DisplaysPage() {
  const [displays, setDisplays] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [modal, setModal] = useState<'create'|'edit'|'delete'|null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({code:'',name:'',displayType:'FLOOR',floorId:'',orientation:'LANDSCAPE',runningText:'',isActive:true,videoPlaylistId:''});
  const [loading, setLoading] = useState(false);
  const dtypes = ['ADMISSION','CASHIER','FLOOR','PHARMACY'];

  const load = useCallback(async () => {
    const [d,f,p] = await Promise.all([api.get('/displays'),api.get('/floors'),api.get('/video/playlists').catch(()=>({data:[]}))]);
    setDisplays(d.data); setFloors(f.data); setPlaylists(p.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({code:'',name:'',displayType:'FLOOR',floorId:'',orientation:'LANDSCAPE',runningText:'',isActive:true,videoPlaylistId:''}); setModal('create'); };
  const openEdit = (d:any) => { setSelected(d); setForm({code:d.code,name:d.name,displayType:d.displayType,floorId:d.floorId||'',orientation:d.orientation,runningText:d.runningText||'',isActive:d.isActive,videoPlaylistId:d.videoPlaylistId||''}); setModal('edit'); };

  const save = async () => {
    setLoading(true);
    try {
      const data = {...form, floorId: form.floorId||null, runningText: form.runningText||null, videoPlaylistId: form.videoPlaylistId||null};
      modal==='create' ? await api.post('/displays',data) : await api.put(`/displays/${selected.id}`,data);
      setModal(null); await load();
    } catch(e:any){alert(e.response?.data?.message||'Gagal');}
    finally{setLoading(false);}
  };
  const remove = async () => { setLoading(true); try{await api.delete(`/displays/${selected.id}`);setModal(null);await load();}catch(e:any){alert(e.response?.data?.message||'Gagal');}finally{setLoading(false);} };

  return (
    <div className={styles.masterPage}>
      <div className={`glass-card ${styles.toolbar}`}>
        <h3 style={{color:'var(--gray-200)',fontWeight:600}}>Display ({displays.length})</h3>
        <button className="btn btn-primary" onClick={openCreate}>+ Tambah Display</button>
      </div>
      <div className={`glass-card ${styles.tableCard}`}><div className={styles.tableWrap}>
        <table className="data-table"><thead><tr><th>Kode</th><th>Nama</th><th>Tipe</th><th>Lantai</th><th>Orientasi</th><th>Footer / Running Text</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>{displays.map(d=>(
          <tr key={d.id}>
            <td><code style={{color:'var(--primary-300)'}}>{d.code}</code></td>
            <td><strong>{d.name}</strong></td>
            <td><span className="badge badge-info">{d.displayType}</span></td>
            <td>{floors.find(f=>f.id===d.floorId)?.name||'-'}</td>
            <td>{d.orientation}</td>
            <td style={{maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={d.runningText||'-'}>{d.runningText || '-'}</td>
            <td><span className={styles.statusDot+' '+(d.isActive?styles.statusActive:styles.statusInactive)}/>{d.isActive?'Aktif':'Nonaktif'}</td>
            <td><div style={{display:'flex',gap:6}}><button className="btn btn-secondary btn-sm" onClick={()=>openEdit(d)}>Edit</button><button className="btn btn-danger btn-sm" onClick={()=>{setSelected(d);setModal('delete')}}>Hapus</button></div></td>
          </tr>
        ))}</tbody></table>
      </div></div>

      {(modal==='create'||modal==='edit')&&<div className={styles.modalOverlay} onClick={()=>setModal(null)}><div className={styles.modal} onClick={e=>e.stopPropagation()}>
        <h3 className={styles.modalTitle}>{modal==='create'?'Tambah':'Edit'} Display</h3>
        <div className="form-group"><label className="form-label">Kode</label><input className="form-input" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} disabled={modal==='edit'}/></div>
        <div className="form-group"><label className="form-label">Nama</label><input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
        <div className="form-group"><label className="form-label">Tipe</label><select className="form-select" value={form.displayType} onChange={e=>setForm({...form,displayType:e.target.value})}>{dtypes.map(t=><option key={t}>{t}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Lantai</label><select className="form-select" value={form.floorId} onChange={e=>setForm({...form,floorId:e.target.value})}><option value="">-- Tidak ada --</option>{floors.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Orientasi</label><select className="form-select" value={form.orientation} onChange={e=>setForm({...form,orientation:e.target.value})}><option>LANDSCAPE</option><option>PORTRAIT</option></select></div>
        <div className="form-group"><label className="form-label">Video Playlist</label><select className="form-select" value={form.videoPlaylistId} onChange={e=>setForm({...form,videoPlaylistId:e.target.value})}><option value="">-- Tidak ada --</option>{playlists.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Footer / Running Text</label><textarea className="form-input" rows={3} value={form.runningText} onChange={e=>setForm({...form,runningText:e.target.value})} placeholder="Teks berjalan di bagian bawah TV..."/></div>
        <div className={styles.modalActions}><button className="btn btn-secondary" onClick={()=>setModal(null)}>Batal</button><button className="btn btn-primary" onClick={save} disabled={loading}>{loading?'...':'Simpan'}</button></div>
      </div></div>}

      {modal==='delete'&&<div className={styles.modalOverlay} onClick={()=>setModal(null)}><div className={styles.modal} onClick={e=>e.stopPropagation()}><div className={styles.deleteConfirm}><h3 className={styles.modalTitle}>Hapus Display</h3><p>Yakin hapus <strong>{selected?.name}</strong>?</p><div className={styles.modalActions} style={{justifyContent:'center'}}><button className="btn btn-secondary" onClick={()=>setModal(null)}>Batal</button><button className="btn btn-danger" onClick={remove} disabled={loading}>{loading?'...':'Hapus'}</button></div></div></div></div>}
    </div>
  );
}
