'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import styles from './live.module.css';
import Link from 'next/link';

export default function LiveDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await api.get('/reports/live-stats');
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch live stats', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll every 10 seconds for live updates
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <div className={styles.loading}>Memuat Live Dashboard...</div>;
  }

  const units = [
    { key: 'ADMISSION', label: 'Admisi', path: '/dashboard/admission', icon: '🏥', color: '#0d9488' },
    { key: 'ASSESSMENT', label: 'Pengkajian', path: '/dashboard/assessment', icon: '📋', color: '#2563eb' },
    { key: 'BDR', label: 'BDR', path: '/dashboard/bdr', icon: '💉', color: '#db2777' },
    { key: 'DOCTOR', label: 'Dokter/Poli', path: '/dashboard/doctor', icon: '👨‍⚕️', color: '#ea580c' },
    { key: 'CDC', label: 'CDC', path: '/dashboard/cdc', icon: '🔬', color: '#4f46e5' },
    { key: 'CASHIER', label: 'Kasir', path: '/dashboard/cashier', icon: '💳', color: '#059669' },
    { key: 'PHARMACY', label: 'Farmasi', path: '/dashboard/pharmacy', icon: '💊', color: '#16a34a' },
    { key: 'OPTIC', label: 'Optik', path: '/dashboard/optic', icon: '👓', color: '#0284c7' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Live Queue Dashboard</h1>
        <div className={styles.pulseIndicator}>
          <span className={styles.pulseDot}></span>
          Live (Auto-refresh 10s)
        </div>
      </div>

      <div className={styles.topStatsGrid}>
        <div className={styles.topStatCard}>
          <h3>Total Tiket Hari Ini</h3>
          <div className={styles.topStatValue}>{stats?.todayTickets || 0}</div>
        </div>
        <div className={styles.topStatCard}>
          <h3>Total Kunjungan</h3>
          <div className={styles.topStatValue}>{stats?.todayVisits || 0}</div>
        </div>
        <div className={styles.topStatCard}>
          <h3>Pasien Aktif (Menunggu/Dilayani)</h3>
          <div className={styles.topStatValue}>{stats?.activePatients || 0}</div>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Antrian Aktif Per Unit</h2>
      
      <div className={styles.unitGrid}>
        {units.map(unit => (
          <Link href={unit.path} key={unit.key} className={styles.unitCard} style={{ borderTopColor: unit.color }}>
            <div className={styles.unitHeader}>
              <span className={styles.unitIcon}>{unit.icon}</span>
              <h3>{unit.label}</h3>
            </div>
            <div className={styles.unitContent}>
              <div className={styles.activeNumber} style={{ color: unit.color }}>
                {stats?.unitCounts[unit.key] || 0}
              </div>
              <span className={styles.activeLabel}>Pasien Aktif</span>
            </div>
            <div className={styles.unitFooter}>
              Buka Antrian →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
