'use client';

import { useState } from 'react';
import api from '@/lib/api';
import Logo from '@/components/Logo';
import styles from './kasir.module.css';

export default function KioskKasirPage() {
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateTicket = async (patientType: 'UMUM' | 'ASURANSI') => {
    setLoading(true);
    try {
      const res = await api.post('/queue-tickets/cashier', { patientType });
      setTicket(res.data);

      setTimeout(() => {
        window.print();
        setTimeout(() => {
          setTicket(null);
        }, 3000);
      }, 500);

    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengambil antrian');
    } finally {
      setLoading(false);
    }
  };

  if (ticket) {
    return (
      <div className={styles.ticketPrint}>
        <div className={styles.printHeader}>
          <h2>RS JEC ORBITA</h2>
          <p>Makassar</p>
        </div>
        <div className={styles.printType}>ANTRIAN KASIR - {ticket.patientType}</div>
        <div className={styles.printNumber}>{ticket.ticketNo}</div>
        <div className={styles.printDate}>
          {new Date(ticket.createdAt).toLocaleString('id-ID')}
        </div>
        <div className={styles.printFooter}>
          <p>Silakan tunggu nomor Anda dipanggil.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.glassHeader}>
        <div className={styles.logoWrapper}>
          <Logo />
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
              <p className={styles.cardDesc}>Pembayaran menggunakan Asuransi Kesehatan / BPJS</p>
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
