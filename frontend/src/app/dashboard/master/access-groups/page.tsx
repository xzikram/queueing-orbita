'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from '../master.module.css';

const PERMISSION_LABELS: Record<string, { label: string; icon: string }> = {
  dashboard: { label: 'Dashboard', icon: '📊' },
  admission: { label: 'Admisi', icon: '🏥' },
  assessment: { label: 'Pengkajian', icon: '📋' },
  bdr: { label: 'BDR', icon: '💉' },
  doctor: { label: 'Dokter/Poli', icon: '👨‍⚕️' },
  cdc: { label: 'CDC', icon: '🔬' },
  cashier: { label: 'Kasir', icon: '💳' },
  pharmacy: { label: 'Farmasi', icon: '💊' },
  optic: { label: 'Optik', icon: '👓' },
  master: { label: 'Master Data', icon: '⚙️' },
  schedules: { label: 'Jadwal Dokter', icon: '📅' },
  live: { label: 'Live Dashboard', icon: '📈' },
  reports: { label: 'Analytics Reports', icon: '📉' },
  audit: { label: 'Audit Logs', icon: '🛡️' },
};

const ALL_PERMISSION_KEYS = Object.keys(PERMISSION_LABELS);

interface AccessGroup {
  id: string;
  role: string;
  name: string;
  description: string | null;
  permissions: string[];
  isActive: boolean;
}

export default function AccessGroupsPage() {
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'edit' | null>(null);
  const [selected, setSelected] = useState<AccessGroup | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/access-groups');
      setGroups(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (group: AccessGroup) => {
    if (group.role === 'ADMIN') return;
    setSelected(group);
    setEditPermissions([...group.permissions]);
    setModal('edit');
  };

  const togglePermission = (key: string) => {
    setEditPermissions(prev =>
      prev.includes(key)
        ? prev.filter(p => p !== key)
        : [...prev, key]
    );
  };

  const selectAll = () => setEditPermissions([...ALL_PERMISSION_KEYS]);
  const deselectAll = () => setEditPermissions([]);

  const save = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await api.put(`/access-groups/${selected.role}`, {
        permissions: editPermissions,
      });
      setModal(null);
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setLoading(false);
    }
  };

  const syncDefaults = async () => {
    setSyncing(true);
    try {
      const res = await api.post('/access-groups/sync');
      alert(res.data.message);
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal sync');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.masterPage}>
      <div className={`glass-card ${styles.toolbar}`}>
        <div className={styles.toolbarLeft}>
          <input
            className={styles.searchInput}
            placeholder="Cari role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          className="btn btn-secondary"
          onClick={syncDefaults}
          disabled={syncing}
        >
          {syncing ? 'Syncing...' : '🔄 Sync Defaults'}
        </button>
      </div>

      <div className={`glass-card ${styles.tableCard}`}>
        <div className={styles.tableWrap}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Nama Group</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => (
                <tr key={g.id || g.role}>
                  <td>
                    <span className="badge badge-primary">{g.role}</span>
                  </td>
                  <td><strong>{g.name}</strong></td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 480 }}>
                      {g.role === 'ADMIN' ? (
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                          ⭐ FULL ACCESS
                        </span>
                      ) : (
                        g.permissions.map(p => (
                          <span
                            key={p}
                            className="badge badge-info"
                            style={{ fontSize: '0.65rem', padding: '1px 6px' }}
                          >
                            {PERMISSION_LABELS[p]?.icon} {PERMISSION_LABELS[p]?.label || p}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      className={styles.statusDot + ' ' + (g.isActive ? styles.statusActive : styles.statusInactive)}
                    />
                    {g.isActive ? 'Aktif' : 'Nonaktif'}
                  </td>
                  <td>
                    {g.role === 'ADMIN' ? (
                      <span style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>
                        🔒 Tidak bisa diedit
                      </span>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(g)}
                      >
                        Edit Permissions
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>
                    Belum ada access group. Klik "Sync Defaults" untuk membuat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Permissions Modal */}
      {modal === 'edit' && selected && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
          <div
            className={styles.modal}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 600 }}
          >
            <h3 className={styles.modalTitle}>
              Edit Permissions — {selected.name}
              <span
                className="badge badge-primary"
                style={{ marginLeft: 8, verticalAlign: 'middle' }}
              >
                {selected.role}
              </span>
            </h3>

            <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-secondary" onClick={selectAll}>
                Pilih Semua
              </button>
              <button className="btn btn-sm btn-secondary" onClick={deselectAll}>
                Hapus Semua
              </button>
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--gray-500)', alignSelf: 'center' }}>
                {editPermissions.length}/{ALL_PERMISSION_KEYS.length} dipilih
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 8,
                maxHeight: 400,
                overflowY: 'auto',
                padding: '4px 0',
              }}
            >
              {ALL_PERMISSION_KEYS.map(key => {
                const checked = editPermissions.includes(key);
                const info = PERMISSION_LABELS[key];
                return (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${checked ? 'var(--primary-400)' : 'var(--border-color)'}`,
                      background: checked ? 'var(--primary-50)' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      fontSize: '0.85rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(key)}
                      style={{
                        width: 18,
                        height: 18,
                        accentColor: 'var(--primary-500)',
                        cursor: 'pointer',
                      }}
                    />
                    <span>{info?.icon}</span>
                    <span style={{ fontWeight: checked ? 600 : 400, color: checked ? 'var(--primary-700)' : 'var(--gray-700)' }}>
                      {info?.label || key}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className={styles.modalActions}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Batal
              </button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>
                {loading ? 'Menyimpan...' : 'Simpan Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
