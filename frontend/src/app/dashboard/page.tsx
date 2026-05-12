'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import styles from './page.module.css';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>({
    totalTickets: 0,
    waitingAdmission: 0,
    inProgress: 0,
    doctors: 0,
  });
  const [recentTickets, setRecentTickets] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [ticketsRes, schedulesRes] = await Promise.all([
        api.get('/queue-tickets/today'),
        api.get('/schedules/active-today'),
      ]);
      const tickets = ticketsRes.data;
      setRecentTickets(tickets.slice(-10).reverse());
      setStats({
        totalTickets: tickets.length,
        waitingAdmission: tickets.filter((t: any) => t.status === 'WAITING').length,
        inProgress: tickets.filter((t: any) => t.status === 'IN_PROGRESS').length,
        doctors: schedulesRes.data.length,
      });
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        <div className={`glass-card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: 'rgba(20, 184, 166, 0.15)' }}>🎫</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.totalTickets}</span>
            <span className={styles.statLabel}>Total Antrian Hari Ini</span>
          </div>
        </div>
        <div className={`glass-card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.15)' }}>⏳</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.waitingAdmission}</span>
            <span className={styles.statLabel}>Menunggu Admisi</span>
          </div>
        </div>
        <div className={`glass-card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.15)' }}>🔄</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.inProgress}</span>
            <span className={styles.statLabel}>Sedang Dilayani</span>
          </div>
        </div>
        <div className={`glass-card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: 'rgba(99, 102, 241, 0.15)' }}>👨‍⚕️</div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{stats.doctors}</span>
            <span className={styles.statLabel}>Dokter Aktif Hari Ini</span>
          </div>
        </div>
      </div>

      <div className={`glass-card ${styles.tableSection}`}>
        <h3 className={styles.sectionTitle}>Antrian Terakhir</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>No. Antrian</th>
              <th>Tipe</th>
              <th>Dokter</th>
              <th>Ruangan</th>
              <th>Status</th>
              <th>Waktu</th>
            </tr>
          </thead>
          <tbody>
            {recentTickets.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '32px' }}>
                  Belum ada antrian hari ini
                </td>
              </tr>
            ) : (
              recentTickets.map((ticket: any) => (
                <tr key={ticket.id}>
                  <td><strong style={{ color: 'var(--primary-300)' }}>{ticket.ticketNo}</strong></td>
                  <td>
                    <span className={`badge ${ticket.patientType === 'UMUM' ? 'badge-primary' : 'badge-info'}`}>
                      {ticket.patientType}
                    </span>
                  </td>
                  <td>{ticket.selectedDoctor?.doctorName || '-'}</td>
                  <td>{ticket.selectedRoom?.name || '-'}</td>
                  <td>
                    <span className={`badge ${
                      ticket.status === 'WAITING' ? 'badge-warning' :
                      ticket.status === 'IN_PROGRESS' ? 'badge-primary' :
                      ticket.status === 'FINISHED' ? 'badge-success' : 'badge-danger'
                    }`}>
                      {ticket.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--gray-400)', fontSize: '0.8125rem' }}>
                    {new Date(ticket.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
