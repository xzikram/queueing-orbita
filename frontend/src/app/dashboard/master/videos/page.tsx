'use client';

import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import styles from '../master.module.css';

export default function VideoManagementPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/video/all');
      setVideos(res.data);
    } catch (err) {
      console.error('Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/video/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchVideos();
    } catch (err: any) {
      alert(`Gagal upload: ${err.response?.data?.message || err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.put(`/video/items/${id}/toggle`);
      fetchVideos();
    } catch (err) {
      alert('Gagal mengubah status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus video ini?')) return;
    try {
      await api.delete(`/video/items/${id}`);
      fetchVideos();
    } catch (err) {
      alert('Gagal menghapus');
    }
  };

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';

  return (
    <div className={styles.masterPage}>
      <div className={`glass-card ${styles.toolbar}`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--gray-900)' }}>Manajemen Video</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--gray-600)', fontSize: '0.9rem' }}>Upload video promosi untuk layar TV. Video yang aktif akan diputar otomatis.</p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm"
              style={{ display: 'none' }}
              onChange={handleUpload}
              disabled={uploading}
            />
            <button
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ margin: 0, whiteSpace: 'nowrap' }}
            >
              {uploading ? '⏳ Mengupload...' : '📤 Upload Video'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-500)' }}>
          Memuat data video...
        </div>
      ) : videos.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎥</div>
          <h3 style={{ color: 'var(--gray-600)', marginBottom: '8px' }}>Belum ada video</h3>
          <p style={{ color: 'var(--gray-500)' }}>Klik tombol "Upload Video" untuk menambahkan video promosi yang akan diputar di layar TV.</p>
        </div>
      ) : (
        <div className={`glass-card ${styles.tableCard}`}>
          <div className={styles.tableWrap}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>No</th>
                  <th>Nama File</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Preview</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((video, index) => (
                  <tr key={video.id} style={{ opacity: video.isActive ? 1 : 0.5 }}>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--gray-500)' }}>{index + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{video.title}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <a
                        href={apiBase + video.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--primary-500)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        📺 Buka
                      </a>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleToggle(video.id)}
                        style={{
                          padding: '6px 16px',
                          borderRadius: '20px',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          background: video.isActive ? '#dcfce7' : '#fee2e2',
                          color: video.isActive ? '#166534' : '#991b1b',
                        }}
                      >
                        {video.isActive ? '● Aktif' : '○ Nonaktif'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => handleDelete(video.id)} className="btn btn-danger btn-sm">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
