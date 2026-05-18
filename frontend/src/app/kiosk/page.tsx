'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import styles from './kiosk.module.css';
import Logo from '@/components/Logo';

type PatientType = 'BARU' | 'LAMA' | 'ASURANSI' | 'ONLINE';

interface ScheduleItem {
  id: string;
  startTime: string;
  endTime: string;
  quota: number;
  bookedCount: number;
  doctor: { id: string; doctorCode: string; doctorName: string };
  room: { id: string; name: string; floor?: { name: string } };
}

const categories: { type: PatientType; code: string; label: string; desc: string; color: string }[] = [
  { type: 'BARU', code: 'A', label: 'PASIEN BARU', desc: 'Pendaftaran Pasien Baru', color: '#2563eb' },
  { type: 'LAMA', code: 'B', label: 'PASIEN LAMA', desc: 'Pasien Sudah Pernah Berobat', color: '#1e40af' },
  { type: 'ASURANSI', code: 'C', label: 'ASURANSI', desc: 'Pasien Asuransi', color: '#f97316' },
  { type: 'ONLINE', code: 'D', label: 'ONLINE', desc: 'Sudah Daftar Online', color: '#ea580c' },
];

export default function KioskPage() {
  const [selectedType, setSelectedType] = useState<PatientType | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  const formatTime = (timeStr: string) => {
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  const isTimePassed = (endTimeStr: string) => {
    if (!endTimeStr) return false;
    // Extract HH:mm from formatTime
    const timeStr = formatTime(endTimeStr);
    const match = timeStr.match(/(\d+)[:.](\d+)/);
    if (!match) return false;
    
    const endHours = parseInt(match[1], 10);
    const endMinutes = parseInt(match[2], 10);
    const endTotal = endHours * 60 + endMinutes;
    
    const now = new Date();
    const currentTotal = now.getHours() * 60 + now.getMinutes();
    
    return currentTotal > endTotal;
  };

  const loadSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await api.get(`/schedules?date=${today}`);
      setSchedules(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoadingSchedules(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const generateTicket = async (scheduleId?: string) => {
    if (!selectedType) return;
    setLoading(true);
    try {
      const body: any = { patientType: selectedType };
      if (scheduleId) body.scheduleId = scheduleId;
      const res = await api.post('/queue-tickets/admission', body);
      setTicket(res.data);
      // Refresh schedules to update booked counts
      loadSchedules();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal generate antrian');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelectedType(null);
    setTicket(null);
  };

  const selectedCat = categories.find(c => c.type === selectedType);

  // ── Ticket Result Screen ──
  if (ticket) {
    return (
      <div className={styles.container}>
        <div className={`no-print ${styles.ticketScreen}`}>
          <div className={styles.ticketCard}>
            <div className={styles.ticketBadge}>Nomor Antrian Anda</div>
            <div className={styles.ticketNumber}>{ticket.ticketNo}</div>
            <div className={styles.ticketType}>
              <span className="badge badge-primary" style={{ fontSize: '1rem', padding: '6px 18px' }}>
                {ticket.patientType}
              </span>
            </div>
            {ticket.selectedDoctor && (
              <div className={styles.ticketDoctor}>
                <span>👨‍⚕️</span> {ticket.selectedDoctor.doctorName}
              </div>
            )}
            {ticket.selectedRoom && (
              <div className={styles.ticketRoom}>
                <span>🚪</span> Ruangan: {ticket.selectedRoom.name}
                {ticket.selectedRoom.floor && ` — ${ticket.selectedRoom.floor.name}`}
              </div>
            )}
            <div className={styles.ticketDetails}>
              <div>📅 {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
            <div className={styles.ticketInstructions}>
              Silakan menunggu di area admisi.<br />
              Nomor antrian Anda akan dipanggil di TV.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '400px', marginTop: '24px' }}>
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={() => window.print()}>
              🖨️ Cetak Tiket
            </button>
            <button className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={reset}>
              🏠 Selesai
            </button>
          </div>
        </div>

        {/* Thermal Printer Layout (58mm/80mm) */}
        <div className="print-only">
          <div style={{
            textAlign: 'center',
            width: '48mm',
            fontFamily: "'Courier New', Courier, monospace",
            color: 'black',
            padding: '4mm 0',
            margin: '0 auto',
          }}>
            <p style={{ margin: '0', fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px' }}>
              RS JEC-ORBITA
            </p>

            <div style={{ borderTop: '1px dashed black', margin: '6px 0' }}></div>

            <p style={{ margin: '6px 0 2px 0', fontSize: '11px' }}>
              NOMOR ANTRIAN:
            </p>
            <p style={{ margin: '0', fontSize: '48px', fontWeight: '900', letterSpacing: '3px', lineHeight: 1.1 }}>
              {ticket.ticketNo}
            </p>

            {ticket.selectedDoctor && (
              <p style={{ margin: '4px 0', fontSize: '11px', fontWeight: 'bold' }}>
                {ticket.selectedDoctor.doctorName}
              </p>
            )}
            {ticket.selectedRoom && (
              <p style={{ margin: '2px 0', fontSize: '10px' }}>
                Ruangan: {ticket.selectedRoom.name}
              </p>
            )}

            <div style={{ borderTop: '1px dashed black', margin: '6px 0' }}></div>

            <p style={{ margin: '3px 0', fontSize: '10px' }}>
              {new Date().toLocaleDateString('id-ID', { weekday: 'long' })}{' '}
              {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}{' '}
              {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </p>

            <div style={{ borderTop: '1px dashed black', margin: '6px 0' }}></div>

            <p style={{ margin: '3px 0', fontSize: '9px' }}>
              TERIMA KASIH ANDA
            </p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>
              TELAH TERTIB MENGANTRI
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: '9px' }}>
              Semoga lekas sembuh!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Split View ──
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={`no-print ${styles.header}`}>
        <div className={styles.headerLogoWrap}>
          <img src="/logo.png" alt="Logo" style={{ height: '100%', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </div>
        <h1 className={styles.headerTitle}>Ambil Nomor Antrian</h1>
        <p className={styles.headerSub}>Silakan pilih kategori pasien dan dokter tujuan Anda</p>
      </div>

      {/* Split View */}
      <div className={styles.splitView}>
        {/* Left: Category Selection */}
        <div className={styles.leftPanel}>
          <h2 className={styles.panelTitle}>Pilih Kategori Pasien</h2>
          <div className={styles.categoryList}>
            {categories.map(cat => (
              <button
                key={cat.type}
                className={`${styles.categoryCard} ${selectedType === cat.type ? styles.categoryActive : ''}`}
                style={{ '--cat-color': cat.color } as React.CSSProperties}
                onClick={() => setSelectedType(cat.type)}
                disabled={loading}
              >
                <div className={styles.categoryCode}>{cat.code}</div>
                <div className={styles.categoryInfo}>
                  <div className={styles.categoryName}>{cat.label}</div>
                  <div className={styles.categoryDesc}>{cat.desc}</div>
                </div>
                {selectedType === cat.type && <div className={styles.categoryCheck}>✓</div>}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Doctor Selection */}
        <div className={styles.rightPanel}>
          {!selectedType ? (
            <div className={styles.placeholderPanel}>
              <div className={styles.placeholderIcon}>👈</div>
              <h3 className={styles.placeholderTitle}>Pilih Kategori Terlebih Dahulu</h3>
              <p className={styles.placeholderDesc}>Silakan pilih kategori pasien di sebelah kiri untuk melihat daftar dokter yang tersedia hari ini.</p>
            </div>
          ) : (
            <>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Pilih Dokter Tujuan</h2>
                {selectedCat && (
                  <span className={styles.selectedBadge} style={{ background: selectedCat.color }}>
                    {selectedCat.code} — {selectedCat.label}
                  </span>
                )}
              </div>

              {loadingSchedules ? (
                <div className={styles.placeholderPanel}>
                  <div className={styles.spinner}></div>
                  <p className={styles.placeholderDesc}>Memuat jadwal dokter...</p>
                </div>
              ) : schedules.length === 0 ? (
                <div className={styles.placeholderPanel}>
                  <div className={styles.placeholderIcon}>📋</div>
                  <h3 className={styles.placeholderTitle}>Tidak Ada Jadwal Hari Ini</h3>
                  <p className={styles.placeholderDesc}>Belum ada jadwal dokter yang tersedia untuk hari ini.</p>
                  <button
                    className={`btn btn-primary ${styles.skipDoctorBtn}`}
                    onClick={() => generateTicket()}
                    disabled={loading}
                    style={{ marginTop: 20 }}
                  >
                    {loading ? 'Memproses...' : 'Ambil Antrian Tanpa Pilih Dokter'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <button
                    className={styles.doctorCard}
                    onClick={() => generateTicket()}
                    disabled={loading}
                    style={{ 
                      marginBottom: '16px', 
                      background: '#f1f5f9', 
                      border: '2px dashed #94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}
                  >
                    <div style={{ fontSize: '2.5rem' }}>🤷</div>
                    <div>
                      <div className={styles.doctorName}>Belum Tahu / Tidak Pilih Dokter</div>
                      <div className={styles.doctorMeta} style={{ marginBottom: 0 }}>
                        Ambil antrian langsung ke Admisi, penentuan dokter nanti dibantu oleh petugas loket.
                      </div>
                    </div>
                  </button>
                  <div className={styles.doctorGrid}>
                    {schedules.map(s => {
                      const passed = isTimePassed(s.endTime);
                      return (
                        <button
                          key={s.id}
                          className={`${styles.doctorCard} ${passed ? styles.doctorFull : ''}`}
                          onClick={() => !passed && generateTicket(s.id)}
                          disabled={loading || passed}
                          style={passed ? { opacity: 0.6 } : undefined}
                        >
                          <div className={styles.doctorName}>{s.doctor.doctorName}</div>
                          <div className={styles.doctorMeta}>
                            <span>🚪 {s.room?.name}</span>
                            <span>🕐 {formatTime(s.startTime)} - {formatTime(s.endTime)}</span>
                          </div>
                          {passed && <div className={styles.fullLabel}>JADWAL BERAKHIR</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
