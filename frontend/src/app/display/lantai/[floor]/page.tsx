'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getSocket, joinDisplay } from '@/lib/socket';
import api from '@/lib/api';
import styles from './floor-display.module.css';
import Logo from '@/components/Logo';

interface CallData {
  ticketNo: string;
  roomName?: string;
  doctorName?: string;
  unitType: string;
  calledAt: Date;
}

export default function FloorDisplayPage() {
  const params = useParams();
  const floorNumber = params.floor as string;
  const displayCode = `display_lantai_${floorNumber}`;

  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [recentBdr, setRecentBdr] = useState<CallData[]>([]);
  const [recentPoli, setRecentPoli] = useState<CallData[]>([]);
  const [waitingList, setWaitingList] = useState<any[]>([]);
  const [time, setTime] = useState(new Date());
  const [connected, setConnected] = useState(false);
  // Video & Ticker state
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
  const [runningText, setRunningText] = useState(`Selamat datang di RS JEC ORBITA — Lantai ${floorNumber}. Mohon menunggu nomor antrian Anda dipanggil. • Selalu patuhi protokol kesehatan.`);
  const videoRef = useRef<HTMLVideoElement>(null);

  const playBell = useCallback((data: CallData) => {
    try {
      const dest = data.roomName || data.unitType;
      const msg = `Nomor antrian. ${data.ticketNo.split('').join(' ')}. silakan menuju ke. ${dest}.`;
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'id-ID';
      utterance.rate = 0.85;

      // Lower video volume during speech
      if (videoRef.current) {
        videoRef.current.volume = 0.2;
      }
      utterance.onend = () => {
        if (videoRef.current) videoRef.current.volume = 1;
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech error', e);
    }
  }, []);

  const handleVideoEnded = () => {
    if (playlist.length > 0) {
      setCurrentVideoIdx((prev) => (prev + 1) % playlist.length);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const res = await api.get(`/queue-tickets/floor-display/${floorNumber}`);
      setRecentBdr(res.data.recentBdr);
      setRecentPoli(res.data.recentPoli);
      setWaitingList(res.data.waitingList);
      if (res.data.recentPoli.length > 0 && res.data.recentBdr.length > 0) {
        // pick the latest across both
        const all = [...res.data.recentBdr, ...res.data.recentPoli].sort((a,b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime());
        setCurrentCall(all[0]);
      } else if (res.data.recentPoli.length > 0) {
        setCurrentCall(res.data.recentPoli[0]);
      } else if (res.data.recentBdr.length > 0) {
        setCurrentCall(res.data.recentBdr[0]);
      }

      // Load Display Config (Video + Ticker)
      const dRes = await api.get(`/displays/code/${displayCode}`);
      if (dRes.data?.videoPlaylist) {
        try {
          setPlaylist(JSON.parse(dRes.data.videoPlaylist));
        } catch {}
      }
      if (dRes.data?.runningText) setRunningText(dRes.data.runningText);

    } catch (err) {
      console.error(err);
    }
  }, [floorNumber, displayCode]);

  useEffect(() => {
    loadData();
    const socket = getSocket();

    socket.on('connect', () => {
      setConnected(true);
      joinDisplay(displayCode);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('settingUpdate', (data) => {
      if (data.type === 'TICKER' && data.text) setRunningText(data.text);
    });

    socket.on('playlistUpdate', (data) => {
      if (data.playlist) setPlaylist(data.playlist);
      setCurrentVideoIdx(0);
    });

    const handleQueueCall = (data: CallData) => {
      setCurrentCall(data);
      if (data.unitType === 'BDR') {
        setRecentBdr(prev => {
          const filtered = prev.filter(p => p.ticketNo !== data.ticketNo);
          return [data, ...filtered].slice(0, 5);
        });
      } else {
        setRecentPoli(prev => {
          const filtered = prev.filter(p => p.ticketNo !== data.ticketNo);
          return [data, ...filtered].slice(0, 5);
        });
      }
      playBell(data);
      // Refresh waiting list slightly after call
      setTimeout(loadData, 2000);
    };

    socket.on('queueCall', handleQueueCall);

    const clockInterval = setInterval(() => setTime(new Date()), 1000);

    return () => {
      socket.off('queueCall', handleQueueCall);
      socket.off('settingUpdate');
      socket.off('playlistUpdate');
      socket.off('connect');
      socket.off('disconnect');
      clearInterval(clockInterval);
    };
  }, [displayCode, loadData, playBell]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoContainer}>
            <img src="/logo.png" alt="Logo" className={styles.logoImage} />
          </div>
          <div className={styles.titleWrapper}>
            <h1>Lantai {floorNumber}</h1>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.clock}>
            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className={`${styles.dot} ${connected ? styles.online : styles.offline}`}>
            {connected ? '● Online' : '○ Offline'}
          </div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        {/* Left Column: Current Call & Waiting List */}
        <div className={styles.leftColumn}>
          {currentCall ? (
            <div className={styles.currentCallCard}>
              <div className={styles.currentLabel}>NOMOR ANTRIAN</div>
              <div className={styles.currentNo}>{currentCall.ticketNo}</div>
              <div className={styles.currentArrow}>→</div>
              <div className={styles.currentDest}>{currentCall.roomName || currentCall.unitType}</div>
            </div>
          ) : (
            <div className={styles.currentCallCard} style={{ opacity: 0.5 }}>
              <div className={styles.currentDest}>Menunggu Panggilan...</div>
            </div>
          )}

          {/* Bottom Section: Waiting List (Pengkajian / BDR) */}
          <div className={styles.waitingSection}>
            <div className={styles.sectionTitle}>Menunggu Dilayani di Lantai {floorNumber}</div>
            <div className={styles.waitingGrid}>
              {waitingList.length === 0 ? (
                <div className={styles.emptySection}>Tidak ada antrian</div>
              ) : (
                waitingList.map((w, idx) => (
                  <div key={idx} className={styles.waitingItem}>
                    <div className={styles.waitingNo}>{w.ticketNo}</div>
                    <div className={styles.waitingInfo}>
                      <div className={styles.waitingName}>{w.patientName || 'Anonim'}</div>
                      <div className={styles.waitingDest}>{w.unitType === 'BDR' ? 'BDR' : w.doctorName || w.roomName || 'Pengkajian'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center Column: Video Area */}
        <div className={styles.centerColumn}>
          <div className={styles.videoArea}>
            {playlist.length > 0 ? (
              <video 
                ref={videoRef}
                src={process.env.NEXT_PUBLIC_API_URL + playlist[currentVideoIdx]?.fileUrl}
                autoPlay
                muted={false}
                onEnded={handleVideoEnded}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '24px' }}
              />
            ) : (
              <div className={styles.videoPlaceholder}>
                <div className={styles.videoIcon}>🎬</div>
                <div className={styles.videoText}>Area Video Informasi</div>
                <div className={styles.videoSub}>Video akan diputar di sini saat tidak ada panggilan</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: History */}
        <div className={styles.rightColumn}>
          <div className={styles.historyBox}>
            <div className={styles.sectionTitle}>Riwayat BDR</div>
            <div className={styles.callList}>
              {recentBdr.length === 0 ? (
                <div className={styles.emptySection}>Kosong</div>
              ) : (
                recentBdr.map((call, idx) => (
                  <div key={idx} className={`${styles.callItem} ${idx === 0 ? styles.callLatest : ''}`}>
                    <span className={styles.callNo}>{call.ticketNo}</span>
                    <span className={styles.callRoom}>BDR</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.historyBox}>
            <div className={styles.sectionTitle}>Riwayat POLI</div>
            <div className={styles.callList}>
              {recentPoli.length === 0 ? (
                <div className={styles.emptySection}>Kosong</div>
              ) : (
                recentPoli.map((call, idx) => (
                  <div key={idx} className={`${styles.callItem} ${idx === 0 ? styles.callLatest : ''}`}>
                    <span className={styles.callNo}>{call.ticketNo}</span>
                    <span className={styles.callRoom}>{call.roomName}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Running Text */}
      <div className={styles.ticker}>
        <div className={styles.tickerContent}>
          <span>{runningText}</span>
        </div>
      </div>
    </div>
  );
}
