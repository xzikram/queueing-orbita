'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import Logo from '@/components/Logo';
import styles from './kasir.module.css';

export default function KioskKasirPage() {
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setTicket(null);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (ticket) {
      timer = setTimeout(() => {
        reset();
      }, 15000); // 15 seconds auto-reset
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [ticket, reset]);

  const generateTicket = async (patientType: 'UMUM' | 'ASURANSI') => {
    setLoading(true);
    try {
      const res = await api.post('/queue-tickets/cashier', { patientType });
      setTicket(res.data);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengambil antrian');
    } finally {
      setLoading(false);
    }
  };

  if (ticket) {
    return (
      <div className={styles.container}>
        {/* Screen Card (no-print) */}
        <div className={`no-print ${styles.ticketScreen}`}>
          <div className={styles.ticketCard}>
            <div className={styles.ticketBadge}>Nomor Antrian Anda</div>
            <div className={styles.ticketNumber}>{ticket.ticketNo}</div>
            <div className={styles.ticketType}>
              <span className="badge badge-primary" style={{ fontSize: '1.25rem', padding: '8px 24px' }}>
                ANTRIAN KASIR - {ticket.patientType}
              </span>
            </div>
            <div className={styles.ticketDetails}>
              <div>📅 {new Date(ticket.createdAt).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div>🕐 {new Date(ticket.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            </div>
            <div className={styles.ticketInstructions}>
              <strong style={{ color: '#ea580c', display: 'block', marginBottom: '8px', fontSize: '1.1rem' }}>📸 BANTU KAMI MENGURANGI PENGGUNAAN KERTAS</strong>
              Silakan foto tiket ini menggunakan handphone Anda, lalu pilih <strong>Selesai</strong>.<br />
              <br />
              Silakan menunggu di area kasir.<br />
              Nomor antrian Anda akan dipanggil di TV.<br />
              <small style={{ display: 'block', marginTop: '16px', color: '#94a3b8', fontStyle: 'italic' }}>Layar akan tertutup otomatis dalam 15 detik...</small>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', width: '100%', maxWidth: '440px', marginTop: '24px' }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ flex: 1, padding: '14px 20px' }}
              onClick={() => {
                window.print();
                setTimeout(reset, 2000);
              }}
            >
              🖨️ Cetak Tiket
            </button>
            <button
              className="btn btn-secondary btn-lg"
              style={{ flex: 1, padding: '14px 20px', background: 'rgba(255, 255, 255, 0.1)', color: 'white', borderColor: 'rgba(255, 255, 255, 0.2)' }}
              onClick={reset}
            >
              🏠 Selesai
            </button>
          </div>
        </div>

        {/* Thermal Printer Layout (58mm/80mm) - print-only */}
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

            <p style={{ margin: '6px 0 2px 0', fontSize: '11px', fontWeight: 'bold' }}>
              ANTRIAN KASIR
            </p>
            <p style={{ margin: '2px 0 6px 0', fontSize: '10px' }}>
              {ticket.patientType}
            </p>
            <p style={{ margin: '0', fontSize: '48px', fontWeight: '900', letterSpacing: '3px', lineHeight: 1.1 }}>
              {ticket.ticketNo}
            </p>

            <div style={{ borderTop: '1px dashed black', margin: '6px 0' }}></div>

            <p style={{ margin: '3px 0', fontSize: '10px' }}>
              {new Date(ticket.createdAt).toLocaleDateString('id-ID', { weekday: 'long' })}{' '}
              {new Date(ticket.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/')}{' '}
              {new Date(ticket.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
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

  return (
    <div className={styles.container}>
      <div className={styles.glassHeader}>
        <div className={styles.logoWrapper}>
          <img src="/logo-orbita.png" alt="Logo RS JEC ORBITA" style={{ height: '100%', width: 'auto', objectFit: 'contain' }} />
        </div>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Kiosk Kasir ORBITA</h1>
          <p className={styles.subtitle}>Sistem Antrean Terintegrasi</p>
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.promptArea}>
          <h2>Silakan Pilih Jenis Pembayaran</h2>
          <p>Pilih kategori yang sesuai untuk mendapatkan tiket antrean Kasir Anda.</p>
        </div>

        {loading ? (
          <div className={styles.loadingWrapper}>
            <div className={styles.modernSpinner}></div>
            <p>Memproses antrean Anda...</p>
          </div>
        ) : (
          <div className={styles.cardGrid}>
            <button
              className={`${styles.selectionCard} ${styles.cardUmum}`}
              onClick={() => generateTicket('UMUM')}
            >
              <div className={styles.cardIcon}>💰</div>
              <div className={styles.cardCode}>G</div>
              <h3 className={styles.cardLabel}>PASIEN UMUM / PRIBADI</h3>
              <p className={styles.cardDesc}>Pembayaran mandiri atau umum (Non-Asuransi)</p>
              <div className={styles.cardHoverEffect}></div>
            </button>

            <button
              className={`${styles.selectionCard} ${styles.cardAsuransi}`}
              onClick={() => generateTicket('ASURANSI')}
            >
              <div className={styles.cardIcon}>🛡️</div>
              <div className={styles.cardCode}>H</div>
              <h3 className={styles.cardLabel}>PASIEN ASURANSI</h3>
              <p className={styles.cardDesc}>Pembayaran menggunakan Asuransi Kesehatan</p>
              <div className={styles.cardHoverEffect}></div>
            </button>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <p>© {new Date().getFullYear()} RS JEC ORBITA. Hak Cipta Dilindungi.</p>
      </div>
    </div>
  );
}
