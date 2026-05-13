'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getSocket, joinDisplay } from '@/lib/socket';
import api from '@/lib/api';
import styles from './display.module.css';
import Logo from '@/components/Logo';

interface CallData {
  ticketNo: string;
  patientType: string;
  counterName?: string;
  unitType: string;
  calledAt: Date;
}

export default function DisplayAdmisiPage() {
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallData[]>([]);
  const [runningText, setRunningText] = useState('Selamat datang di RS MATA JEC ORBITA @ MAKASSAR. Mohon menunggu nomor antrian Anda dipanggil.');
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
  const [time, setTime] = useState(new Date());
  const [connected, setConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isAudioInit, setIsAudioInit] = useState(false);

  const initAudio = () => {
    // Unlock Web Audio API & SpeechSynthesis
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      ctx.resume();
    }
    const utterance = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(utterance);
    setIsAudioInit(true);
  };

  const playDingDong = async () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const playTone = (freq: number, startTime: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + dur);
      };
      playTone(523.25, ctx.currentTime, 0.5); // C5
      playTone(440.00, ctx.currentTime + 0.4, 0.8); // A4
      return new Promise(resolve => setTimeout(resolve, 1500));
    } catch (e) {
      console.error('DingDong error', e);
    }
  };

  // Custom speech synthesis
  const playBell = useCallback(async (data: CallData) => {
    try {
      if (videoRef.current) videoRef.current.volume = 0.1;

      await playDingDong();

      const msg = `Nomor antrian. ${data.ticketNo.split('').join(' ')}. silakan menuju ke. ${data.counterName || 'Counter'}.`;
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'id-ID';
      utterance.rate = 0.85;

      utterance.onend = () => {
        if (videoRef.current) videoRef.current.volume = 1.0;
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech error', e);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const [callsRes, displayRes, playlistsRes] = await Promise.all([
        api.get('/admission/recent-calls?limit=2'),
        api.get('/displays/code/display_admisi').catch(() => ({ data: null })),
        api.get('/video/playlists').catch(() => ({ data: [] }))
      ]);

      const calls = callsRes.data.map((c: any) => ({
        ticketNo: c.ticketNo,
        counterName: c.targetCounter,
        unitType: c.unitType,
        calledAt: c.calledAt,
      }));
      if (calls.length > 0) {
        setCurrentCall(calls[0]);
        setRecentCalls(calls.slice(1, 2));
      }

      if (displayRes.data) {
        if (displayRes.data.runningText) setRunningText(displayRes.data.runningText);
      }

      // Load video items from all playlists
      const allPlaylists = playlistsRes.data || [];
      const allItems = allPlaylists.flatMap((pl: any) => pl.items || []);
      if (allItems.length > 0) {
        setPlaylist(allItems);
      }
    } catch (err) {
      console.error('Failed to load initial data', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    const socket = getSocket();

    socket.on('connect', () => {
      setConnected(true);
      joinDisplay('display_admisi');
    });

    socket.on('disconnect', () => setConnected(false));

    const handleQueueCall = (data: CallData) => {
      setCurrentCall((prev) => {
        if (prev && prev.ticketNo !== data.ticketNo) {
          setRecentCalls((recent) => {
            if (recent.length > 0 && recent[0].ticketNo === prev.ticketNo) return recent;
            return [prev]; // Only keep 1 recent call
          });
        }
        return data;
      });
      playBell(data);
    };

    socket.on('queueCall', handleQueueCall);

    socket.on('runningTextUpdate', (text: string) => {
      setRunningText(text);
    });

    socket.on('playlistUpdate', (data: any) => {
      if (data && data.items) {
        setPlaylist(data.items);
        setCurrentVideoIdx(0);
      } else {
        setPlaylist([]);
      }
    });

    const clockInterval = setInterval(() => setTime(new Date()), 1000);

    return () => {
      socket.off('queueCall', handleQueueCall);
      socket.off('runningTextUpdate');
      socket.off('playlistUpdate');
      socket.off('connect');
      socket.off('disconnect');
      clearInterval(clockInterval);
    };
  }, [loadInitialData, playBell]);

  const handleVideoEnded = () => {
    if (playlist.length > 0) {
      setCurrentVideoIdx((prev) => (prev + 1) % playlist.length);
    }
  };

  if (!isAudioInit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1e40af', color: 'white', cursor: 'pointer' }} onClick={initAudio}>
        <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>📺 Layar Admisi Siap</h1>
        <p style={{ fontSize: '1.5rem', opacity: 0.8 }}>Klik / Tap di mana saja untuk memulai (Aktivasi Suara)</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoContainer}>
            <img src="/logo.png" alt="Logo" className={styles.logoImage} />
          </div>
          <div className={styles.titleWrapper}>
            <h1 className={styles.headerTitle}>Admisi</h1>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.clock}>
            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className={styles.date}>
            {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className={`${styles.connectionDot} ${connected ? styles.connected : styles.disconnected}`}>
            {connected ? '● Online' : '○ Offline'}
          </div>
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.currentCallSection}>
          {currentCall ? (
            <div className={styles.currentCallCard}>
              <div className={styles.callLabel}>NOMOR ANTRIAN</div>
              <div className={styles.callNumber}>{currentCall.ticketNo}</div>
              <div className={styles.callArrow}>→</div>
              <div className={styles.callCounter}>{currentCall.counterName}</div>
            </div>
          ) : (
            <div className={styles.noCall}>
              <div className={styles.noCallIcon}>🏥</div>
              <div className={styles.noCallText}>Menunggu Panggilan...</div>
            </div>
          )}
        </div>

        <div className={styles.recentSection}>
          <h3 className={styles.recentTitle}>Riwayat Panggilan</h3>
          <div className={styles.recentList}>
            {recentCalls.length === 0 ? (
              <div className={styles.recentEmpty}>Belum ada riwayat</div>
            ) : (
              recentCalls.map((call, idx) => (
                <div key={idx} className={styles.recentItem}>
                  <span className={styles.recentNo}>{call.ticketNo}</span>
                  <span className={styles.recentArrow}>→</span>
                  <span className={styles.recentCounter}>{call.counterName}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={styles.videoArea}>
        {playlist.length > 0 ? (
          <video
            ref={videoRef}
            src={(process.env.NEXT_PUBLIC_API_URL || '/api') + playlist[currentVideoIdx]?.fileUrl}
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

      <div className={styles.ticker}>
        <div className={styles.tickerContent}>
          <span>{runningText}</span>
        </div>
      </div>
    </div>
  );
}
