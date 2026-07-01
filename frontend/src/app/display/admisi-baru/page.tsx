'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getSocket, joinDisplay } from '@/lib/socket';
import api from '@/lib/api';
import styles from './display-baru.module.css';
import Logo from '@/components/Logo';

interface Counter {
  id: string;
  code: string;
  name: string;
  status: string; // 'STANDBY' | 'BUSY'
  activeTicketNo?: string | null;
}

interface CallData {
  ticketNo: string;
  patientType: string;
  counterName?: string;
  unitType: string;
  calledAt: Date;
}

export default function DisplayAdmisiKasirBaruPage() {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [blinkingCounters, setBlinkingCounters] = useState<Record<string, boolean>>({});
  
  const [runningText, setRunningText] = useState('Selamat datang di RS MATA JEC ORBITA @ MAKASSAR. Mohon menunggu nomor antrian Anda dipanggil.');
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
  const [time, setTime] = useState(new Date());
  const [connected, setConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoVolume, setVideoVolume] = useState(0.3);
  const videoVolumeRef = useRef(0.3);
  const [isAudioInit, setIsAudioInit] = useState(false);

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
      videoRef.current.play().catch(e => console.error("Autoplay blocked:", e));
    }
  };

  const initAudio = () => {
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

  const playBell = useCallback(async (data: CallData) => {
    try {
      if (videoRef.current) videoRef.current.volume = 0.1;

      await playDingDong();

      const cleanTicketNo = data.ticketNo.replace(/[^a-zA-Z0-9]/g, '');
      const msg = `Nomor antrian. ${cleanTicketNo.split('').join(' ')}. silakan menuju ke. ${data.counterName || 'Counter'}.`;
      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'id-ID';
      
      const voices = window.speechSynthesis.getVoices();
      const idVoices = voices.filter(v => v.lang === 'id-ID' || v.lang === 'id_ID');
      const femaleVoice = idVoices.find(v => v.name.includes('Google') || v.name.includes('Ayu') || v.name.includes('Gadis') || v.name.toLowerCase().includes('female'));
      
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      } else if (idVoices.length > 0) {
        utterance.voice = idVoices[0];
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.1;

      utterance.onend = () => {
        if (videoRef.current) videoRef.current.volume = videoVolumeRef.current;
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech error', e);
    }
  }, []);

  const getVideoUrl = (fileUrl: string) => {
    if (!fileUrl) return '';
    const apiBase = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:3001/api` : '/api');
    return apiBase + fileUrl;
  };

  const loadInitialData = useCallback(async () => {
    try {
      const [countersRes, displayRes, videosRes] = await Promise.all([
        api.get('/counters').catch(() => ({ data: [] })),
        api.get('/displays/code/display_admisi').catch(() => ({ data: null })),
        api.get('/video/active/display_admisi').catch(() => ({ data: [] }))
      ]);

      // Filter counters to show only those that handle Admission/Cashier and are active
      const activeCounters = (countersRes.data || [])
        .filter((c: any) => (c.canHandleAdmission || c.canHandleCashier) && c.isActive)
        .sort((a: any, b: any) => a.code.localeCompare(b.code))
        .slice(0, 6); // Take exactly 6 counters

      setCounters(activeCounters);

      if (displayRes.data) {
        if (displayRes.data.runningText) setRunningText(displayRes.data.runningText);
        if (displayRes.data.videoVolume !== undefined) setVideoVolume(displayRes.data.videoVolume);
      }

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
    const dataInterval = setInterval(loadInitialData, 5000);

    const socket = getSocket();

    socket.on('connect', () => {
      setConnected(true);
      joinDisplay('display_admisi');
      joinDisplay('display_kasir');
    });

    socket.on('disconnect', () => setConnected(false));

    const handleQueueCall = (data: CallData) => {
      // Find matching counter to blink and update locally first
      setCounters((prev) => {
        const match = prev.find(c => c.name.toLowerCase() === data.counterName?.toLowerCase());
        if (match) {
          // Trigger blink
          setBlinkingCounters(blinks => ({ ...blinks, [match.id]: true }));
          setTimeout(() => {
            setBlinkingCounters(blinks => ({ ...blinks, [match.id]: false }));
          }, 6000); // Stop blink after animation finishes (6 stages of alternate is 4.8s, 6s is safe)
          
          return prev.map(c => c.id === match.id ? { ...c, status: 'STANDBY', activeTicketNo: data.ticketNo } : c);
        }
        return prev;
      });

      playBell(data);
      // Wait for service changes to propagate to db, then fetch fresh counters list
      setTimeout(loadInitialData, 1500);
    };

    socket.on('queueCall', handleQueueCall);

    const handleCounterStatusChanged = (data: { counterId: string; status: string }) => {
      setCounters((prev) => 
        prev.map(c => c.id === data.counterId ? { ...c, status: data.status, activeTicketNo: data.status === 'BUSY' ? null : c.activeTicketNo } : c)
      );
      setTimeout(loadInitialData, 1000);
    };

    socket.on('counterStatusChanged', handleCounterStatusChanged);

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
      socket.off('counterStatusChanged', handleCounterStatusChanged);
      socket.off('runningTextUpdate');
      socket.off('playlistUpdate');
      socket.off('playlistChanged');
      socket.off('videoVolumeUpdate');
      socket.off('connect');
      socket.off('disconnect');
      clearInterval(clockInterval);
      clearInterval(dataInterval);
    };
  }, [loadInitialData, playBell]);

  const handleVideoEnded = () => {
    if (playlist.length === 1) {
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
      <div 
        style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1e40af', color: 'white', cursor: 'pointer' }} 
        onClick={initAudio}
      >
        <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>📺 TV Admisi & Kasir Grid Siap</h1>
        <p style={{ fontSize: '1.5rem', opacity: 0.8 }}>Klik / Tap di mana saja untuk memulai (Aktivasi Suara)</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logoContainer}>
            <img src="/logo.png" alt="Logo" className={styles.logoImage} />
          </div>
          <div className={styles.titleWrapper}>
            <h1>ADMISI DAN KASIR</h1>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.timeRow}>
            <div className={styles.clock}>
              {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className={`${styles.connectionDot} ${connected ? styles.connected : styles.disconnected}`} title={connected ? 'Online' : 'Offline'}>
              {connected ? '●' : '○'}
            </div>
          </div>
          <div className={styles.date}>
            {time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Main Content (Portrait stack: Video on top, Grid of Counters below) */}
      <div className={styles.mainContent}>
        {/* Video Area */}
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
                if (playlist.length > 1) {
                  setCurrentVideoIdx((prev) => (prev + 1) % playlist.length);
                }
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className={styles.videoPlaceholder}>
              <div className={styles.videoIcon}>🎬</div>
              <div className={styles.videoText}>Area Video Informasi</div>
              <div className={styles.videoSub}>Upload video dari Dashboard untuk ditampilkan di sini</div>
            </div>
          )}
        </div>

        {/* 2x3 Counters Grid */}
        <div className={styles.counterGrid}>
          {counters.map((c) => {
            const isBlinking = blinkingCounters[c.id];
            const isBusy = c.status === 'BUSY';
            const hasTicket = !!c.activeTicketNo;

            let cardClass = styles.counterCard;
            if (isBlinking) {
              cardClass += ` ${styles.blink}`;
            } else if (isBusy) {
              cardClass += ` ${styles.counterCardBusy}`;
            } else if (hasTicket) {
              cardClass += ` ${styles.counterCardActive}`;
            }

            return (
              <div key={c.id} className={cardClass}>
                <div className={styles.counterHeader}>{c.name}</div>
                
                {isBusy ? (
                  <div className={`${styles.counterStatus} ${styles.statusBusy}`}>
                    <div>SEDANG</div>
                    <div>MELAYANI</div>
                  </div>
                ) : hasTicket ? (
                  <div className={styles.counterNumber}>{c.activeTicketNo}</div>
                ) : (
                  <div className={styles.counterNumber} style={{ opacity: 0 }}>-</div>
                )}
              </div>
            );
          })}

          {/* Fill remaining boxes if less than 6 counters found in db */}
          {Array.from({ length: Math.max(0, 6 - counters.length) }).map((_, idx) => (
            <div key={`empty-${idx}`} className={styles.counterCard}>
              <div className={styles.counterHeader}>Counter {counters.length + idx + 1}</div>
              <div className={styles.counterNumber} style={{ opacity: 0 }}>-</div>
            </div>
          ))}
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
