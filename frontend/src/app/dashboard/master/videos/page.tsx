'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import styles from '../master.module.css'; // Reuse master styles

export default function VideoPlaylistsPage() {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  
  // Upload state
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const res = await api.get('/video/playlists');
      setPlaylists(res.data);
    } catch (err) {
      alert('Failed to fetch playlists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName) return;
    try {
      await api.post('/video/playlists', { name: newPlaylistName });
      setNewPlaylistName('');
      fetchPlaylists();
    } catch (err) {
      alert('Gagal membuat playlist');
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Hapus playlist ini?')) return;
    try {
      await api.delete(`/video/playlists/${id}`);
      fetchPlaylists();
    } catch (err) {
      alert('Gagal menghapus');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !selectedPlaylistId || !uploadTitle) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('title', uploadTitle);

    try {
      await api.post(`/video/playlists/${selectedPlaylistId}/items`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadFile(null);
      setUploadTitle('');
      setSelectedPlaylistId(null);
      fetchPlaylists();
      alert('Video berhasil di-upload!');
    } catch (err: any) {
      alert(`Gagal upload video: ${err.response?.data?.message || err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Hapus video ini?')) return;
    try {
      await api.delete(`/video/items/${itemId}`);
      fetchPlaylists();
    } catch (err) {
      alert('Gagal menghapus');
    }
  };

  if (loading) return <div style={{ padding: '24px' }}>Memuat data video...</div>;

  return (
    <div className={styles.masterPage}>
      <div className={`glass-card ${styles.toolbar}`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--gray-900)' }}>Manajemen Video Playlist</h1>
        <p style={{ margin: 0, color: 'var(--gray-600)', fontSize: '0.9rem' }}>Kelola video promosi dan informasi untuk layar TV</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedPlaylistId ? '1fr 400px' : '1fr', gap: '24px', alignItems: 'start' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Create Playlist Form */}
          <div className="glass-card">
            <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>Buat Playlist Baru</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Contoh: Playlist Admisi Utama" 
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="form-input"
                style={{ flex: 1, maxWidth: '400px', marginBottom: 0 }}
              />
              <button onClick={handleCreatePlaylist} className="btn btn-primary" style={{ margin: 0 }}>
                Simpan Playlist
              </button>
            </div>
          </div>

          {/* List of Playlists */}
          {playlists.map(pl => (
            <div key={pl.id} className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary-600)' }}>{pl.name}</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setSelectedPlaylistId(pl.id)} className="btn btn-secondary">
                    + Tambah Video
                  </button>
                  <button onClick={() => handleDeletePlaylist(pl.id)} className="btn btn-danger">
                    Hapus
                  </button>
                </div>
              </div>

              {pl.items?.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--gray-500)', background: 'var(--gray-50)', borderRadius: '12px', border: '2px dashed var(--gray-200)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎥</div>
                  <p style={{ margin: 0 }}>Belum ada video di playlist ini.</p>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px', textAlign: 'center' }}>No</th>
                        <th>Judul Video</th>
                        <th>Preview</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pl.items?.map((item: any, index: number) => (
                        <tr key={item.id}>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--gray-500)' }}>{index + 1}</td>
                          <td style={{ fontWeight: 600 }}>{item.title}</td>
                          <td>
                            <a 
                              href={process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') + item.fileUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{ color: 'var(--primary-500)', textDecoration: 'none', fontWeight: 600 }}
                            >
                              📺 Buka Video
                            </a>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button onClick={() => handleDeleteItem(item.id)} className="btn btn-danger btn-sm">
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
          
          {playlists.length === 0 && (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
              <h3 style={{ color: 'var(--gray-500)', margin: 0 }}>Belum ada playlist yang dibuat.</h3>
            </div>
          )}
        </div>

        {/* Upload Form Sidebar */}
        {selectedPlaylistId && (
          <div className="glass-card" style={{ position: 'sticky', top: '24px', border: '2px solid var(--primary-300)', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Upload Video Baru</h3>
              <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem', margin: '4px 0 0' }}>
                Ke: <strong style={{ color: 'var(--primary-600)' }}>{playlists.find(p => p.id === selectedPlaylistId)?.name}</strong>
              </p>
            </div>
            
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Judul Video</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Contoh: Promo Layanan Katarak"
                  className="form-input"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
              </div>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">File Video (.mp4 / .webm)</label>
                <div style={{ border: '2px dashed var(--gray-300)', padding: '16px', borderRadius: '12px', background: 'var(--gray-50)' }}>
                  <input 
                    type="file" 
                    accept="video/mp4,video/webm"
                    required 
                    style={{ width: '100%' }}
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '8px' }}>
                  * Jika error setelah loading lama, kemungkinan batasan Nginx di server belum dinaikkan (maksimal default Nginx adalah 1MB).
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button 
                  type="submit" 
                  disabled={uploading} 
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '12px', margin: 0 }}
                >
                  {uploading ? '⏳ Mengupload...' : '📤 Mulai Upload'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setSelectedPlaylistId(null);
                    setUploadFile(null);
                    setUploadTitle('');
                  }} 
                  className="btn btn-secondary"
                  style={{ margin: 0 }}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
