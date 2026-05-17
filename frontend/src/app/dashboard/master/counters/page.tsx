'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../master.module.css';

export default function CountersPage() {
  const [counters, setCounters] = useState<any[]>([]);
  const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', canHandleAdmission: true, canHandleCashier: false, isActive: true });
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { 
      setFetchError(null);
      const res = await api.get('/counters'); 
      setCounters(res.data); 
    }
    catch (err: any) { 
      console.error('Failed to load counters:', err);
      setFetchError(err.response?.data?.message || err.message || 'Gagal memuat data counter');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ name: '', code: '', canHandleAdmission: true, canHandleCashier: false, isActive: true }); setModal('create'); };
  const openEdit = (c: any) => { setSelected(c); setForm({ name: c.name, code: c.code, canHandleAdmission: c.canHandleAdmission, canHandleCashier: c.canHandleCashier, isActive: c.isActive }); setModal('edit'); };
  const openDelete = (c: any) => { setSelected(c); setModal('delete'); };

  const save = async () => {
    setLoading(true);
    try {
      if (modal === 'create') await api.post('/counters', form);
      else await api.put(`/counters/${selected.id}`, form);
      setModal(null); await load();
    } catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setLoading(false); }
  };

  const remove = async () => {
    setLoading(true);
    try { await api.delete(`/counters/${selected.id}`); setModal(null); await load(); }
    catch (err: any) { alert(err.response?.data?.message || 'Gagal'); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.masterPage}>
      <div className={`glass-card ${styles.toolbar}`}>
        <div className={styles.toolbarLeft}><h3 style={{ color: 'var(--gray-200)', fontWeight: 600 }}>Counter ({counters.length})</h3></div>
        <button className="btn btn-primary" onClick={openCreate}>+ Tambah Counter</button>
      </div>
      {fetchError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#dc2626', fontSize: '0.9rem' }}>⚠️ {fetchError}</span>
          <button className="btn btn-secondary btn-sm" onClick={load} style={{ marginLeft: 12 }}>🔄 Retry</button>
        </div>
      )}
      <div className={`glass-card ${styles.tableCard}`}>
        <div className={styles.tableWrap}>
          <table className="data-table">
            <thead><tr><th>Nama</th><th>Kode</th><th>Admisi</th><th>Kasir</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {counters.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td><code style={{ color: 'var(--primary-300)' }}>{c.code}</code></td>
                  <td>{c.canHandleAdmission ? <span className="badge badge-success">Ya</span> : <span className="badge badge-danger">Tidak</span>}</td>
                  <td>{c.canHandleCashier ? <span className="badge badge-success">Ya</span> : <span className="badge badge-danger">Tidak</span>}</td>
                  <td><span className={styles.statusDot + ' ' + (c.isActive ? styles.statusActive : styles.statusInactive)} />{c.isActive ? 'Aktif' : 'Nonaktif'}</td>
                  <td><div style={{ display: 'flex', gap: 6 }}><button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button><button className="btn btn-danger btn-sm" onClick={() => openDelete(c)}>Hapus</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{modal === 'create' ? 'Tambah Counter' : 'Edit Counter'}</h3>
            <div className="form-group"><label className="form-label">Nama</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Kode</label><input className="form-input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div className="form-group" style={{ display: 'flex', gap: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-300)', fontSize: '0.875rem' }}><input type="checkbox" checked={form.canHandleAdmission} onChange={e => setForm({ ...form, canHandleAdmission: e.target.checked })} /> Admisi</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-300)', fontSize: '0.875rem' }}><input type="checkbox" checked={form.canHandleCashier} onChange={e => setForm({ ...form, canHandleCashier: e.target.checked })} /> Kasir</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-300)', fontSize: '0.875rem' }}><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Aktif</label>
            </div>
            <div className={styles.modalActions}><button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn btn-primary" onClick={save} disabled={loading}>{loading ? '...' : 'Simpan'}</button></div>
          </div>
        </div>
      )}

      {modal === 'delete' && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.deleteConfirm}><h3 className={styles.modalTitle}>Hapus Counter</h3><p>Yakin ingin menghapus <strong>{selected?.name}</strong>?</p>
              <div className={styles.modalActions} style={{ justifyContent: 'center' }}><button className="btn btn-secondary" onClick={() => setModal(null)}>Batal</button><button className="btn btn-danger" onClick={remove} disabled={loading}>{loading ? '...' : 'Hapus'}</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
