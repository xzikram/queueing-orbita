'use client';

import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import styles from '../master.module.css';

export default function VideoManagementPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displays, setDisplays] = useState<any[]>([]);
  const [targetModal, setTargetModal] = useState<any>(null);
  const [volumeSaving, setVolumeSaving] = useState<string | null>(null);

  const fetchDisplays = async () => {
    try {
      const res = await api.get('/displays');
      // Hide deprecated display_kasir since it's merged with admisi
      let fetchedDisplays = res.data.filter((d: any) => d.code !== 'display_kasir');
      // Rename display_admisi to Admisi & Kasir for clarity
      fetchedDisplays = fetchedDisplays.map((d: any) => {
        if (d.code === 'display_admisi') return { ...d, name: 'TV Admisi & Kasir' };
        return d;
      });
      setDisplays(fetchedDisplays);
    } catch (err) {}
  };

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
    fetchDisplays();
  }, []);

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per chunk

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      // Send each chunk
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk, `chunk_${i}`);
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', String(i));
        formData.append('totalChunks', String(totalChunks));

        await api.post('/video/upload-chunk', formData, {
          headers: { 'Content-Type': undefined },
          timeout: 60000, // 60s per chunk is plenty
        });

        // Update progress based on chunks completed
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 95)); // 0-95% for chunks
      }

      // Tell backend to assemble the final file
      setUploadProgress(97);
      await api.post('/video/upload-complete', {
        uploadId,
        totalChunks,
        fileName: file.name,
      });

      setUploadProgress(100);
      fetchVideos();
    } catch (err: any) {
      alert(`Gagal upload: ${err.response?.data?.message || err.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
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

  const openTargetModal = (video: any) => {
    const currentTargets = video.targets?.map((t: any) => t.displayId) || [];
    setTargetModal({ ...video, selectedDisplays: currentTargets });
  };

  const toggleTarget = (displayId: string) => {
    setTargetModal((prev: any) => {
      const sel = prev.selectedDisplays.includes(displayId)
        ? prev.selectedDisplays.filter((id: string) => id !== displayId)
        : [...prev.selectedDisplays, displayId];
      return { ...prev, selectedDisplays: sel };
    });
  };

  const saveTargets = async () => {
    try {
      await api.put(`/video/items/${targetModal.id}/targets`, {
        displayIds: targetModal.selectedDisplays
      });
      setTargetModal(null);
      fetchVideos();
    } catch (err) {
      alert('Gagal menyimpan target display');
    }
  };

  const handleVolumeChange = (displayId: string, volume: number) => {
    setDisplays(prev => prev.map(d => d.id === displayId ? { ...d, videoVolume: volume } : d));
  };

  const handleVolumeSave = async (displayId: string, volume: number) => {
    setVolumeSaving(displayId);
    try {
      await api.put(`/displays/${displayId}`, { videoVolume: volume });
    } catch (err) {
      console.error('Failed to save volume');
    } finally {
      setTimeout(() => setVolumeSaving(null), 500);
    }
  };

  const getVolumeIcon = (vol: number) => {
    if (vol === 0) return '🔇';
    if (vol < 0.3) return '🔈';
    if (vol < 0.7) return '🔉';
    return '🔊';
  };

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';

  return (
    <div className={styles.masterPage}>
      <div className={`glass-card ${styles.toolbar}`} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--gray-900)' }}>Manajemen Video</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--gray-600)', fontSize: '0.9rem' }}>Upload video promosi dan atur di TV mana video akan diputar.</p>
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
              style={{ margin: 0, whiteSpace: 'nowrap', position: 'relative', overflow: 'hidden' }}
            >
              {uploading && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, bottom: 0,
                  width: `${uploadProgress}%`,
                  background: 'rgba(255, 255, 255, 0.25)',
                  transition: 'width 0.2s ease',
                }} />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>
                {uploading ? `⏳ Mengupload... ${uploadProgress}%` : '📤 Upload Video'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Volume Control Section */}
      <div className="glass-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '1.2rem' }}>🔊</span>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)' }}>Kontrol Volume Video per Display</h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', marginLeft: '4px' }}>
            Atur volume rendah agar suara panggilan antrian tetap terdengar jelas
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
          {displays.map(disp => {
            const vol = disp.videoVolume ?? 0.3;
            const color = vol > 0.7 ? '#ef4444' : vol > 0.4 ? '#f59e0b' : '#22c55e';
            return (
              <div key={disp.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', background: '#f8fafc', borderRadius: '10px',
                border: '1px solid #e2e8f0',
              }}>
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{getVolumeIcon(vol)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {disp.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(vol * 100)}
                      onChange={(e) => handleVolumeChange(disp.id, parseInt(e.target.value) / 100)}
                      onMouseUp={(e) => handleVolumeSave(disp.id, parseInt((e.target as HTMLInputElement).value) / 100)}
                      onTouchEnd={(e) => handleVolumeSave(disp.id, parseInt((e.target as HTMLInputElement).value) / 100)}
                      style={{ flex: 1, height: '6px', cursor: 'pointer', accentColor: color }}
                    />
                    <span style={{ minWidth: '38px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color }}>
                      {volumeSaving === disp.id ? '✅' : `${Math.round(vol * 100)}%`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
                  <th>Target Display</th>
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
                    <td>
                      {video.targets?.length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {video.targets.map((t: any) => (
                            <span key={t.displayId} style={{ background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                              {t.display?.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>Semua Display (Global)</span>
                      )}
                      <button 
                        onClick={() => openTargetModal(video)}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', marginTop: '4px', padding: 0 }}
                      >
                        ✏️ Atur Target
                      </button>
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

      {targetModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 16px', color: '#1e293b' }}>📺 Atur Target Display</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
              Pilih di TV mana saja video <strong>{targetModal.title}</strong> akan diputar. Kosongkan jika ingin video ini diputar di SEMUA TV (Global).
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', marginBottom: '24px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {displays.map(disp => (
                <label key={disp.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px', background: 'white', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <input 
                    type="checkbox" 
                    checked={targetModal.selectedDisplays.includes(disp.id)}
                    onChange={() => toggleTarget(disp.id)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{disp.name}</div>
                    <div style={{ color: '#94a3b8', fontSize: '12px' }}>{disp.code}</div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setTargetModal(null)}>Batal</button>
              <button className="btn btn-primary" onClick={saveTargets}>💾 Simpan Target</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
