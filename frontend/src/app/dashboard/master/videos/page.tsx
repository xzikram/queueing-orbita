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
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadFile(null);
      setUploadTitle('');
      fetchPlaylists();
      alert('Video berhasil di-upload!');
    } catch (err) {
      alert('Gagal upload video');
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

  if (loading) return <div>Memuat...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Manajemen Video Playlist</h1>
      </div>

      <div className={styles.card} style={{ marginBottom: '24px' }}>
        <h3>Buat Playlist Baru</h3>
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <input 
            type="text" 
            placeholder="Nama Playlist" 
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            className="form-control"
            style={{ maxWidth: '300px' }}
          />
          <button onClick={handleCreatePlaylist} className="btn btn-primary">Simpan</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
        <div>
          {playlists.map(pl => (
            <div key={pl.id} className={styles.card} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>{pl.name}</h3>
                <div>
                  <button onClick={() => setSelectedPlaylistId(pl.id)} className="btn btn-secondary btn-sm" style={{ marginRight: '8px' }}>+ Upload Video</button>
                  <button onClick={() => handleDeletePlaylist(pl.id)} className="btn btn-danger btn-sm">Hapus</button>
                </div>
              </div>

              {pl.items?.length === 0 ? (
                <p style={{ color: '#64748b' }}>Belum ada video.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>Urutan</th>
                      <th>Judul Video</th>
                      <th>File/URL</th>
                      <th style={{ width: '80px' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pl.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td>{item.sortOrder}</td>
                        <td>{item.title}</td>
                        <td>
                          <a href={process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') + item.fileUrl} target="_blank" rel="noreferrer">Lihat</a>
                        </td>
                        <td>
                          <button onClick={() => handleDeleteItem(item.id)} className="btn btn-danger btn-sm">X</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>

        {selectedPlaylistId && (
          <div className={styles.card}>
            <h3>Upload ke: {playlists.find(p => p.id === selectedPlaylistId)?.name}</h3>
            <form onSubmit={handleUpload} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label>Judul Video</label>
                <input 
                  type="text" 
                  required 
                  className="form-control"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                />
              </div>
              <div>
                <label>File Video (.mp4)</label>
                <input 
                  type="file" 
                  accept="video/mp4,video/webm"
                  required 
                  className="form-control"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </div>
              <button type="submit" disabled={uploading} className="btn btn-primary">
                {uploading ? 'Mengupload...' : 'Upload Video'}
              </button>
              <button type="button" onClick={() => setSelectedPlaylistId(null)} className="btn btn-secondary">
                Batal
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
