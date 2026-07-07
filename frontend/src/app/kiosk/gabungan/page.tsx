'use client';

import { useRouter } from 'next/navigation';
import styles from './gabungan.module.css';

export default function KioskGabunganPage() {
  const router = useRouter();

  const handleSelect = (route: string) => {
    router.push(route);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.glassHeader}>
        <div className={styles.logoWrapper}>
          <img src="/logo-orbita.png" alt="Logo RS JEC ORBITA" style={{ height: '100%', width: 'auto', objectFit: 'contain' }} />
        </div>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Kiosk Mandiri ORBITA</h1>
          <p className={styles.subtitle}>ANTRIAN ADMISI & KASIR</p>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <div className={styles.promptArea}>
          <h2>Selamat Datang</h2>
          <p>Silakan pilih layanan yang Anda butuhkan untuk memulai antrean Anda hari ini.</p>
        </div>

        <div className={styles.cardGrid}>
          {/* Card Pendaftaran */}
          <button
            className={`${styles.selectionCard} ${styles.cardPendaftaran}`}
            onClick={() => handleSelect('/kiosk?from=gabungan')}
          >
            <div className={styles.cardIcon}>📝</div>
            <div className={styles.cardCode}>ADM</div>
            <h3 className={styles.cardLabel}>Pendaftaran</h3>
            <p className={styles.cardDesc}>
              Ambil nomor antrean untuk pendaftaran pasien baru, pasien lama, pendaftaran online, maupun asuransi.
            </p>
            <div className={styles.cardHoverEffect}></div>
          </button>

          {/* Card Pembayaran */}
          <button
            className={`${styles.selectionCard} ${styles.cardPembayaran}`}
            onClick={() => handleSelect('/kiosk/kasir?from=gabungan')}
          >
            <div className={styles.cardIcon}>💳</div>
            <div className={styles.cardCode}>KSR</div>
            <h3 className={styles.cardLabel}>Pembayaran</h3>
            <p className={styles.cardDesc}>
              Ambil nomor antrean kasir untuk melakukan pembayaran umum/pribadi maupun pembayaran dengan asuransi.
            </p>
            <div className={styles.cardHoverEffect}></div>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <p>© {new Date().getFullYear()} RS JEC ORBITA. Hak Cipta Dilindungi.</p>
      </div>
    </div>
  );
}
