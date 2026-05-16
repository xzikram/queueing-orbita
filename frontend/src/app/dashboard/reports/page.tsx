'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import styles from './reports.module.css';

const UNITS = [
  { id: 'ADMISSION', label: 'Admisi', icon: '🏥' },
  { id: 'CASHIER', label: 'Kasir', icon: '💳' },
  { id: 'PHARMACY', label: 'Farmasi', icon: '💊' },
  { id: 'DOCTOR', label: 'Poli/Dokter', icon: '👨‍⚕️' },
  { id: 'ASSESSMENT', label: 'Pengkajian', icon: '📋' },
  { id: 'BDR', label: 'BDR', icon: '💉' },
  { id: 'CDC', label: 'CDC', icon: '🔬' },
  { id: 'OPTIC', label: 'Optik', icon: '👓' },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('ADMISSION');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Default 7 days ago
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/unit-detailed/${activeTab}`, {
        params: { startDate, endDate },
      });
      setReportData(res.data);
    } catch (error) {
      console.error('Failed to fetch reports', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, activeTab]);

  const handleExportExcel = async () => {
    try {
      const res = await api.get('/reports/export-excel', {
        params: { startDate, endDate, unitType: activeTab },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_${activeTab}_${startDate}_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      alert('Gagal export data');
    }
  };

  // Prepare chart data
  const chartData = reportData ? Object.keys(reportData.hourlyDistribution).map(hour => ({
    hour: `${hour}:00`,
    pasien: reportData.hourlyDistribution[Number(hour)]
  })) : [];

  const formatMins = (sec: number) => Math.round(sec / 60);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h1>📉 Analytics Reports</h1>
          <p>Laporan detail kinerja per unit layanan</p>
        </div>
        <div className={styles.filters}>
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '12px' }}>Dari Tanggal</label>
            <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group mb-0">
            <label className="form-label" style={{ fontSize: '12px' }}>Sampai Tanggal</label>
            <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={handleExportExcel} style={{ alignSelf: 'flex-end', height: '42px' }}>
            📥 Export Excel
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        {UNITS.map(unit => (
          <button
            key={unit.id}
            className={`${styles.tabBtn} ${activeTab === unit.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(unit.id)}
          >
            {unit.icon} {unit.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Memuat data laporan...</div>
        ) : reportData ? (
          <div className={styles.reportContainer}>
            {/* KPI Cards */}
            <div className={styles.kpiGrid}>
              <div className={`${styles.kpiCard} ${styles.kpiPrimary}`}>
                <h3>Total Pasien Selesai</h3>
                <div className={styles.kpiValue}>{reportData.totalPatients} <span className={styles.kpiUnit}>pasien</span></div>
              </div>
              <div className={`${styles.kpiCard} ${styles.kpiWarning}`}>
                <h3>Waktu Tunggu (Rata-rata)</h3>
                <div className={styles.kpiValue}>{formatMins(reportData.avgWaitSeconds)} <span className={styles.kpiUnit}>menit</span></div>
                <div className={styles.kpiSub}>Tercepat: {formatMins(reportData.minWaitSeconds)}m | Terlama: {formatMins(reportData.maxWaitSeconds)}m</div>
              </div>
              <div className={`${styles.kpiCard} ${styles.kpiSuccess}`}>
                <h3>Waktu Layanan (Rata-rata)</h3>
                <div className={styles.kpiValue}>{formatMins(reportData.avgServeSeconds)} <span className={styles.kpiUnit}>menit</span></div>
                <div className={styles.kpiSub}>Tercepat: {formatMins(reportData.minServeSeconds)}m | Terlama: {formatMins(reportData.maxServeSeconds)}m</div>
              </div>
            </div>

            {/* Chart */}
            <div className={`glass-card ${styles.chartCard}`}>
              <h3>📊 Distribusi Pasien Per Jam</h3>
              <p className={styles.chartSub}>Menunjukkan jam sibuk di unit {UNITS.find(u => u.id === activeTab)?.label}</p>
              <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="pasien" name="Jumlah Pasien" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.empty}>Tidak ada data laporan.</div>
        )}
      </div>
    </div>
  );
}
