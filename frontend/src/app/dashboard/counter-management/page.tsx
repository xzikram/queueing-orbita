'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import styles from './counter-management.module.css';

interface CounterData {
  id: string;
  code: string;
  name: string;
  assignedRole: string | null;
  assignedUserId: string | null;
  isActive: boolean;
  assignedUser: { id: string; name: string; email: string; role: string } | null;
}

export default function CounterManagementPage() {
  const [counters, setCounters] = useState<CounterData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCounters = useCallback(async () => {
    try {
      const res = await api.get('/counter-assignment');
      setCounters(res.data);
    } catch (err) {
      console.error('Failed to load counters', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCounters();

    const socket = getSocket();
    socket.on('counterAssignmentUpdate', (data: CounterData[]) => {
      if (Array.isArray(data)) {
        setCounters(data);
      }
    });

    return () => {
      socket.off('counterAssignmentUpdate');
    };
  }, [loadCounters]);

  const assignRole = async (counterId: string, role: string | null) => {
    try {
      await api.put(`/counter-assignment/${counterId}/role`, { role });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengubah assignment');
    }
  };

  const toggleActive = async (counterId: string, isActive: boolean) => {
    try {
      await api.put(`/counter-assignment/${counterId}/toggle-active`, { isActive });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengubah status');
    }
  };

  const removeUser = async (counterId: string) => {
    try {
      await api.put(`/counter-assignment/${counterId}/user`, { userId: null });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menghapus petugas');
    }
  };

  if (loading) {
    return <div className={styles.loading}>Memuat data counter...</div>;
  }

  const admissionCounters = counters.filter(c => c.assignedRole === 'ADMISSION');
  const cashierCounters = counters.filter(c => c.assignedRole === 'CASHIER');
  const unassigned = counters.filter(c => !c.assignedRole);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>⚙️ Manajemen Counter</h1>
        <p className={styles.subtitle}>Kelola assignment counter untuk Admisi dan Kasir</p>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={`${styles.summaryCard} ${styles.summaryAdmission}`}>
          <h3>Counter Admisi</h3>
          <div className={styles.summaryValue}>{admissionCounters.length}</div>
        </div>
        <div className={`${styles.summaryCard} ${styles.summaryCashier}`}>
          <h3>Counter Kasir</h3>
          <div className={styles.summaryValue}>{cashierCounters.length}</div>
        </div>
        <div className={`${styles.summaryCard} ${styles.summaryUnassigned}`}>
          <h3>Belum Di-assign</h3>
          <div className={styles.summaryValue}>{unassigned.length}</div>
        </div>
      </div>

      {/* Counter Grid */}
      <div className={styles.counterGrid}>
        {counters.map(counter => (
          <div
            key={counter.id}
            className={`${styles.counterCard} ${
              counter.assignedRole === 'ADMISSION'
                ? styles.cardAdmission
                : counter.assignedRole === 'CASHIER'
                ? styles.cardCashier
                : styles.cardUnassigned
            } ${!counter.isActive ? styles.cardInactive : ''}`}
          >
            <div className={styles.counterHeader}>
              <div className={styles.counterName}>{counter.name}</div>
              <div className={styles.counterCode}>{counter.code}</div>
            </div>

            <div className={styles.assignedBadge}>
              {counter.assignedRole === 'ADMISSION' && <span className={styles.badgeAdmission}>🏥 ADMISI</span>}
              {counter.assignedRole === 'CASHIER' && <span className={styles.badgeCashier}>💳 KASIR</span>}
              {!counter.assignedRole && <span className={styles.badgeNone}>— Belum di-assign —</span>}
            </div>

            <div className={styles.userSection}>
              {counter.assignedUser ? (
                <div className={styles.userInfo}>
                  <span className={styles.userIcon}>👤</span>
                  <div>
                    <div className={styles.userName}>{counter.assignedUser.name}</div>
                    <div className={styles.userRole}>{counter.assignedUser.role}</div>
                  </div>
                  <button className={styles.removeUserBtn} onClick={() => removeUser(counter.id)} title="Keluarkan petugas">✕</button>
                </div>
              ) : (
                <div className={styles.noUser}>
                  <span className={styles.userIcon} style={{ opacity: 0.3 }}>👤</span>
                  <span>Tidak ada petugas</span>
                </div>
              )}
            </div>

            <div className={styles.actionRow}>
              <select
                value={counter.assignedRole || ''}
                onChange={e => assignRole(counter.id, e.target.value || null)}
                className={styles.roleSelect}
              >
                <option value="">— Tidak di-assign —</option>
                <option value="ADMISSION">🏥 Admisi</option>
                <option value="CASHIER">💳 Kasir</option>
              </select>
              <button
                className={`${styles.toggleBtn} ${counter.isActive ? styles.toggleActive : styles.toggleInactive}`}
                onClick={() => toggleActive(counter.id, !counter.isActive)}
              >
                {counter.isActive ? '🟢 Aktif' : '🔴 Nonaktif'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
