'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import styles from './reports.module.css';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReportsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [unitData, setUnitData] = useState<any[]>([]);
  const [doctorData, setDoctorData] = useState<any[]>([]);
  const [detailData, setDetailData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Default 7 days ago
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [unitType, setUnitType] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { startDate, endDate, unitType: unitType || undefined };
      
      const [sumRes, unitRes, docRes, detailRes] = await Promise.all([
        api.get('/reports/journey-summary', { params }),
        api.get('/reports/unit-summary', { params }),
        api.get('/reports/doctor-summary', { params }),
        api.get('/reports/journey-detail', { params: { ...params, limit: 100 } })
      ]);

      setSummary(sumRes.data);
      setUnitData(unitRes.data);
      setDoctorData(docRes.data);
      setDetailData(detailRes.data.data);
    } catch (error) {
      console.error('Failed to fetch reports', error);
      alert('Gagal memuat data laporan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, unitType]);

  const handleExportExcel = async () => {
    try {
      const res = await api.get('/reports/export-excel', {
        params: { startDate, endDate, unitType: unitType || undefined },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Perjalanan_Pasien_${startDate}_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      alert('Gagal export Excel');
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(16);
    doc.text('Laporan Perjalanan Pasien (Orbita)', 14, 15);
    doc.setFontSize(11);
    doc.text(`Periode: ${startDate} s/d ${endDate}`, 14, 22);

    const tableColumn = ["No. Tiket", "Tipe", "Unit", "Lantai", "Ruangan", "Dokter", "Tunggu (Mnt)", "Layanan (Mnt)"];
    const tableRows: any[] = [];

    detailData.forEach(item => {
      const rowData = [
        item.visit?.queueTicket?.ticketNo || '-',
        item.visit?.patientType || '-',
        item.unitType,
        item.floor?.name || '-',
        item.room?.name || '-',
        item.doctor?.doctorName || '-',
        item.waitingDurationSeconds ? Math.round(item.waitingDurationSeconds / 60) : 0,
        item.serviceDurationSeconds ? Math.round(item.serviceDurationSeconds / 60) : 0,
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 167, 69] }
    });

    doc.save(`Laporan_Orbita_${startDate}_${endDate}.pdf`);
  };

  const formatMinutes = (seconds: number) => Math.round((seconds || 0) / 60);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Historical Analytics & Reports</h1>
        <div className={styles.exportButtons}>
          <button onClick={handleExportExcel} className={styles.btnExportExcel}>
            Download Excel
          </button>
          <button onClick={handleExportPDF} className={styles.btnExportPdf}>
            Download PDF
          </button>
        </div>
      </div>

      <div className={styles.filterCard}>
        <div className={styles.filterGroup}>
          <label>Tanggal Mulai</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className={styles.filterGroup}>
          <label>Tanggal Akhir</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className={styles.filterGroup}>
          <label>Unit Pelayanan</label>
          <select value={unitType} onChange={e => setUnitType(e.target.value)}>
            <option value="">Semua Unit</option>
            <option value="ADMISSION">Admisi</option>
            <option value="ASSESSMENT">Pengkajian</option>
            <option value="BDR">BDR</option>
            <option value="DOCTOR">Dokter/Poli</option>
            <option value="CDC">CDC</option>
            <option value="CASHIER">Kasir</option>
            <option value="PHARMACY">Farmasi</option>
            <option value="OPTIC">Optik</option>
          </select>
        </div>
        <button onClick={fetchData} className={styles.btnFilter} disabled={loading}>
          {loading ? 'Memuat...' : 'Terapkan Filter'}
        </button>
      </div>

      {summary && (
        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <h3>Total Sesi Selesai</h3>
            <p className={styles.kpiValue}>{summary.totalPatients}</p>
          </div>
          <div className={styles.kpiCard}>
            <h3>Rata-rata Waktu Tunggu</h3>
            <p className={styles.kpiValue}>{formatMinutes(summary.avgWaitSeconds)} Menit</p>
          </div>
          <div className={styles.kpiCard}>
            <h3>Rata-rata Durasi Layanan</h3>
            <p className={styles.kpiValue}>{formatMinutes(summary.avgServeSeconds)} Menit</p>
          </div>
          <div className={styles.kpiCard}>
            <h3>Max Waktu Tunggu</h3>
            <p className={styles.kpiValue}>{formatMinutes(summary.maxWaitSeconds)} Menit</p>
          </div>
        </div>
      )}

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3>Rata-rata Waktu (Menit) per Unit</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={unitData.map(d => ({
                name: d.unitType,
                Tunggu: formatMinutes(d.avgWaitSeconds),
                Layanan: formatMinutes(d.avgServeSeconds)
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="Tunggu" fill="#ffc107" />
                <Bar dataKey="Layanan" fill="#28a745" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <h3>Performa Dokter (Top Wait & Serve Time)</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={doctorData.map(d => ({
                name: d.doctorName.substring(0, 10) + '...',
                Tunggu: formatMinutes(d.avgWaitSeconds),
                Layanan: formatMinutes(d.avgServeSeconds)
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="Tunggu" fill="#dc3545" />
                <Bar dataKey="Layanan" fill="#17a2b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <h3>Data Detail Perjalanan (Terbaru 100 Data)</h3>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Waktu Daftar</th>
              <th>Tiket</th>
              <th>Tipe</th>
              <th>Unit</th>
              <th>Dokter</th>
              <th>Loket/Ruang</th>
              <th>Waktu Tunggu</th>
              <th>Durasi Layanan</th>
            </tr>
          </thead>
          <tbody>
            {detailData.map((item, idx) => (
              <tr key={item.id || idx}>
                <td>{item.createdAt ? new Date(item.createdAt).toLocaleString('id-ID') : '-'}</td>
                <td>{item.visit?.queueTicket?.ticketNo || '-'}</td>
                <td>{item.visit?.patientType || '-'}</td>
                <td>{item.unitType}</td>
                <td>{item.doctor?.doctorName || '-'}</td>
                <td>{item.counter?.name || item.room?.name || '-'}</td>
                <td>{formatMinutes(item.waitingDurationSeconds)} mnt</td>
                <td>{formatMinutes(item.serviceDurationSeconds)} mnt</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
