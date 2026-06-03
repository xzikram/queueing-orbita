'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../master.module.css';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'ADMISSION' });
  const [loading, setLoading] = useState(false);

  const roles = ['ADMIN', 'ADMISSION', 'KEPALA_ADMISI', 'CASHIER', 'ASSESSMENT', 'BDR', 'DOCTOR', 'CDC', 'PHARMACY', 'OPTIC', 'MANAGEMENT', 'QUEUE_OFFICER'];

  const load = useCallback(async () => {
    try { const res = await api.get('/users'); setUsers(res.data); }
    catch (err) { console.error(err); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ name: '', email: '', password: '', role: 'ADMISSION' }); setModal('create'); };
  const openEdit = (u: any) => { setSelected(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setModal('edit'); };
  const openDelete = (u: any) => { setSelected(u); setModal('delete'); };

  const save = async () => {
    setLoading(true);
    try {
      if (modal === 'create') {
        await api.post('/users', form);
      } else {
        const data: any = { name: form.name, email: form.email, role: form.role };
        if (form.password) data.password = form.password;
        await api.put(`/users/${selected.id}`, data);
      }
      setModal(null); await load();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal menyimpan'); }
    finally { setLoading(false); }
  };

  const remove = async () => {
    setLoading(true);
    try { await api.delete(`/users/${selected.id}`); setModal(null); await load(); }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal menghapus'); }
    finally { setLoading(false); }
  };

  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={styles.masterPage}>
      <div className={`glass-card ${styles.toolbar}`}>
        <div className={styles.toolbarLeft}>
          <input className={styles.searchInput} placeholder="Cari user..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Tambah User</button>
      </div>

      <div className={`glass-card ${styles.tableCard}`}>
        <div className={styles.tableWrap}>
          <table className="data-table">
            <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td><span className="badge badge-primary">{u.role}</span></td>
                  <td><span className={styles.statusDot + ' ' + (u.isActive ? styles.statusActive : styles.statusInactive)} />{u.isActive ? 'Aktif' : 'Nonaktif'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => openDelete(u)}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{modal === 'create' ? 'Tambah User' : 'Edit User'}</h3>
            <div className="form-group"><label className="form-label">Nama</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Email / NIK / ID</label><input className="form-input" type="text" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Password {modal === 'edit' ? '(kosongkan jika tidak diubah)' : ''}</label><input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Role</label><select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'delete' && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.deleteConfirm}>
              <h3 className={styles.modalTitle}>Hapus User</h3>
              <p>Yakin ingin menghapus <strong>{selected?.name}</strong>?</p>
              <div className={styles.modalActions} style={{ justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button>
                <button className="btn btn-danger" onClick={remove} disabled={loading}>{loading ? 'Menghapus...' : 'Hapus'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
