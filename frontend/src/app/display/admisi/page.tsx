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

export default function DisplayAdmisiKasirPage() {
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallData[]>([]);
  const [runningText, setRunningText] = useState('Selamat datang di RS MATA JEC ORBITA @ MAKASSAR. Mohon menunggu nomor antrian Anda dipanggil.');
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
  const [time, setTime] = useState(new Date());
  const [connected, setConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoVolume, setVideoVolume] = useState(0.3);
  const videoVolumeRef = useRef(0.3);

  useEffect(() => {
    videoVolumeRef.current = videoVolume;
    if (videoRef.current && !window.speechSynthesis.speaking) {
      videoRef.current.volume = videoVolume;
      videoRef.current.muted = videoVolume === 0;
    }
  }, [videoVolume]);

  const handleVideoLoad = () => {
    if (videoRef.current) {
      videoRef.current.volume = videoVolumeRef.current;
      videoRef.current.muted = videoVolumeRef.current === 0;
    }
  };

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
        if (videoRef.current) videoRef.current.volume = videoVolumeRef.current;
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech error', e);
    }
  }, []);

  // Build video URL correctly
  const getVideoUrl = (fileUrl: string) => {
    if (!fileUrl) return '';
    const apiBase = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:3001/api` : '/api');
    // fileUrl is like /uploads/videos/file.mp4
    // apiBase might be http://host:3001/api or /api
    return apiBase + fileUrl;
  };

  const loadInitialData = useCallback(async () => {
    try {
      const [admissionRes, cashierRes, displayRes, videosRes] = await Promise.all([
        api.get('/admission/recent-calls?limit=2').catch(() => ({ data: [] })),
        api.get('/cashier/recent-calls?limit=2').catch(() => ({ data: [] })),
        api.get('/displays/code/display_admisi').catch(() => ({ data: null })),
        api.get('/video/active/display_admisi').catch(() => ({ data: [] }))
      ]);

      // Combine calls from both admisi and kasir, sort by calledAt
      const admissionCalls = (admissionRes.data || []).map((c: any) => ({
        ticketNo: c.ticketNo,
        counterName: c.targetCounter,
        unitType: c.unitType || 'ADMISI',
        calledAt: c.calledAt,
      }));
      const cashierCalls = (cashierRes.data || []).map((c: any) => ({
        ticketNo: c.ticketNo,
        counterName: c.targetCounter || 'Kasir',
        unitType: c.unitType || 'KASIR',
        calledAt: c.calledAt,
      }));

      const allCalls = [...admissionCalls, ...cashierCalls].sort(
        (a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime()
      );

      if (allCalls.length > 0) {
        setCurrentCall(allCalls[0]);
        setRecentCalls(allCalls.slice(1, 3));
      }

      if (displayRes.data) {
        if (displayRes.data.runningText) setRunningText(displayRes.data.runningText);
        if (displayRes.data.videoVolume !== undefined) setVideoVolume(displayRes.data.videoVolume);
      }

      // Load active videos directly
      const activeVideos = videosRes.data || [];
      if (activeVideos.length > 0) {
        setPlaylist(activeVideos);
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
      // Join BOTH admisi and kasir display rooms
      joinDisplay('display_admisi');
      joinDisplay('display_kasir');
    });

    socket.on('disconnect', () => setConnected(false));

    const handleQueueCall = (data: CallData) => {
      setCurrentCall((prev) => {
        if (prev && prev.ticketNo !== data.ticketNo) {
          setRecentCalls((recent) => {
            if (recent.length > 0 && recent[0].ticketNo === prev.ticketNo) return recent;
            return [prev, ...recent].slice(0, 2); // Keep up to 2 recent calls
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

    socket.on('playlistChanged', async () => {
      const videosRes = await api.get('/video/active/display_admisi').catch(() => ({ data: [] }));
      const activeVideos = videosRes.data || [];
      setPlaylist(activeVideos);
      setCurrentVideoIdx(0);
    });

    socket.on('videoVolumeUpdate', (vol: number) => {
      setVideoVolume(vol);
    });

    const clockInterval = setInterval(() => setTime(new Date()), 1000);

    return () => {
      socket.off('queueCall', handleQueueCall);
      socket.off('runningTextUpdate');
      socket.off('playlistUpdate');
      socket.off('playlistChanged');
      socket.off('videoVolumeUpdate');
      socket.off('connect');
      socket.off('disconnect');
      clearInterval(clockInterval);
    };
  }, [loadInitialData, playBell]);

  const handleVideoEnded = () => {
    if (playlist.length === 1) {
      // Single video: restart it manually
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    } else if (playlist.length > 1) {
      setCurrentVideoIdx((prev) => (prev + 1) % playlist.length);
    }
  };

  if (!isAudioInit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1e40af', color: 'white', cursor: 'pointer' }} onClick={initAudio}>
        <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>📺 Layar Admisi & Kasir Siap</h1>
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
            <h1 className={styles.headerTitle}>Admisi dan Kasir</h1>
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
            src={getVideoUrl(playlist[currentVideoIdx]?.fileUrl)}
            autoPlay
            muted={videoVolume === 0}
            onLoadedData={handleVideoLoad}
            loop={playlist.length === 1}
            onEnded={handleVideoEnded}
            onError={(e) => {
              console.error('Video load error:', e);
              // Try next video if current fails
              if (playlist.length > 1) {
                setCurrentVideoIdx((prev) => (prev + 1) % playlist.length);
              }
            }}
            style={{ width: '100%', aspectRatio: '16/9', objectFit: 'contain', borderRadius: '24px', backgroundColor: '#000' }}
          />
        ) : (
          <div className={styles.videoPlaceholder}>
            <div className={styles.videoIcon}>🎬</div>
            <div className={styles.videoText}>Area Video Informasi</div>
            <div className={styles.videoSub}>Upload video dari Dashboard untuk ditampilkan di sini</div>
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
