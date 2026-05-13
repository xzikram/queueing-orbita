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
      await api.post(`/video/playlists/${selectedPlaylistId}/items`, formData);
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
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Manajemen Video Playlist</h1>
          <p className={styles.subtitle}>Kelola video promosi dan informasi untuk layar TV</p>
        </div>
      </div>

      <div className={styles.content}>
        {/* Create Playlist Form */}
        <div className={styles.card} style={{ marginBottom: '24px' }}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Buat Playlist Baru</h3>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className={styles.formGroup} style={{ flex: 1, maxWidth: '400px', marginBottom: 0 }}>
              <input 
                type="text" 
                placeholder="Contoh: Playlist Admisi Utama" 
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className={styles.input}
              />
            </div>
            <button onClick={handleCreatePlaylist} className={styles.btnPrimary}>
              Simpan Playlist
            </button>
          </div>
        </div>

        {/* Playlists Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: selectedPlaylistId ? '1fr 400px' : '1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* List of Playlists */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {playlists.map(pl => (
              <div key={pl.id} className={styles.card}>
                <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className={styles.cardTitle} style={{ fontSize: '1.25rem', color: '#1e40af' }}>{pl.name}</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setSelectedPlaylistId(pl.id)} 
                      className={styles.btnSecondary}
                      style={{ background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}
                    >
                      + Tambah Video
                    </button>
                    <button onClick={() => handleDeletePlaylist(pl.id)} className={styles.btnDanger}>
                      Hapus
                    </button>
                  </div>
                </div>

                {pl.items?.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎥</div>
                    <p>Belum ada video di playlist ini.</p>
                  </div>
                ) : (
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
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
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#64748b' }}>{index + 1}</td>
                            <td style={{ fontWeight: 500 }}>{item.title}</td>
                            <td>
                              <a 
                                href={process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') + item.fileUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                              >
                                📺 Buka Video
                              </a>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                onClick={() => handleDeleteItem(item.id)} 
                                className={styles.btnDanger}
                                style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                              >
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
              <div style={{ padding: '40px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ color: '#64748b' }}>Belum ada playlist yang dibuat.</h3>
              </div>
            )}
          </div>

          {/* Upload Form Sidebar */}
          {selectedPlaylistId && (
            <div className={styles.card} style={{ position: 'sticky', top: '24px', border: '2px solid #bfdbfe', boxShadow: '0 10px 25px rgba(37,99,235,0.1)' }}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Upload Video Baru</h3>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
                  Ke: <strong style={{ color: '#1e40af' }}>{playlists.find(p => p.id === selectedPlaylistId)?.name}</strong>
                </p>
              </div>
              
              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Judul Video</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Contoh: Promo Layanan Katarak"
                    className={styles.input}
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>File Video (.mp4 / .webm)</label>
                  <div style={{ border: '2px dashed #cbd5e1', padding: '16px', borderRadius: '12px', background: '#f8fafc' }}>
                    <input 
                      type="file" 
                      accept="video/mp4,video/webm"
                      required 
                      style={{ width: '100%' }}
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    />
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '8px' }}>
                    * Pastikan ukuran file tidak terlalu besar agar pemutaran lancar. Maksimal disarankan: 50MB.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button 
                    type="submit" 
                    disabled={uploading} 
                    className={styles.btnPrimary}
                    style={{ flex: 1, padding: '12px' }}
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
                    className={styles.btnSecondary}
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
