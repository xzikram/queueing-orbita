'use client';

import { useEffect, useState } from 'react';
import { getSocket, joinDisplay } from '@/lib/socket';
import styles from '../admisi/display.module.css';
import Logo from '@/components/Logo';

interface CallData {
  ticketNo: string;
  roomName?: string;
  unitType: string;
  calledAt: Date;
}

export default function DisplayFarmasiPage() {
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallData[]>([]);
  const [time, setTime] = useState(new Date());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socket.on('connect', () => { setConnected(true); joinDisplay('display_farmasi'); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('queueCall', (data: CallData) => {
      setCurrentCall(prev => {
        if (prev) setRecentCalls(r => [prev, ...r].slice(0, 7));
        return data;
      });
    });
    const clockInterval = setInterval(() => setTime(new Date()), 1000);
    return () => { socket.off('queueCall'); socket.off('connect'); socket.off('disconnect'); clearInterval(clockInterval); };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <Logo size={40} />
          </div>
          <div>
            <h1 className={styles.headerTitle}>ANTRIAN FARMASI</h1>
            <p className={styles.headerSub}>Klinik Orbita</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.clock}>{time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div className={styles.date}>{time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <div className={`${styles.connectionDot} ${connected ? styles.connected : styles.disconnected}`}>{connected ? '● Online' : '○ Offline'}</div>
        </div>
      </div>
      <div className={styles.mainContent}>
        <div className={styles.currentCallSection}>
          {currentCall ? (
            <div className={styles.currentCallCard}>
              <div className={styles.callLabel}>AMBIL OBAT</div>
              <div className={styles.callNumber}>{currentCall.ticketNo}</div>
              <div className={styles.callArrow}>→</div>
              <div className={styles.callCounter}>Loket Farmasi</div>
            </div>
          ) : (
            <div className={styles.noCall}><div className={styles.noCallIcon}>💊</div><div className={styles.noCallText}>Menunggu Panggilan...</div></div>
          )}
        </div>
        <div className={styles.recentSection}>
          <h3 className={styles.recentTitle}>Riwayat Panggilan</h3>
          <div className={styles.recentList}>
            {recentCalls.length === 0 ? <div className={styles.recentEmpty}>Belum ada</div> : recentCalls.map((call, idx) => (
              <div key={idx} className={styles.recentItem}>
                <span className={styles.recentNo}>{call.ticketNo}</span>
                <span className={styles.recentArrow}>→</span>
                <span className={styles.recentCounter}>Farmasi</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.ticker}>
        <div className={styles.tickerContent}>Obat Anda sedang disiapkan. Silakan tunggu hingga nomor antrian dipanggil. • Obat Anda sedang disiapkan. Silakan tunggu hingga nomor antrian dipanggil.</div>
      </div>
    </div>
  );
}
