'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  const [isAudioInit, setIsAudioInit] = useState(false);
  // Video & Ticker state
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
  const [runningText, setRunningText] = useState(`Selamat datang di RS JEC ORBITA — Lantai ${floorNumber}. Mohon menunggu nomor antrian Anda dipanggil. • Selalu patuhi protokol kesehatan.`);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoVolume, setVideoVolume] = useState(0.3);
  const videoVolumeRef = useRef(0.3);
  const waitingTrackRef = useRef<HTMLDivElement>(null);

  // Determine if waiting list needs scrolling (more than fits in viewport)
  const SCROLL_THRESHOLD = 6; // number of items before enabling auto-scroll
  const needsScroll = waitingList.length > SCROLL_THRESHOLD;
  const scrollDuration = useMemo(() => {
    // Longer duration for more items so scroll is gentle
    return Math.max(20, waitingList.length * 4);
  }, [waitingList.length]);

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
      playTone(523.25, ctx.currentTime, 0.5);
      playTone(440.00, ctx.currentTime + 0.4, 0.8);
      return new Promise(resolve => setTimeout(resolve, 1500));
    } catch (e) {
      console.error('DingDong error', e);
    }
  };

  const playBell = useCallback(async (data: CallData) => {
    try {
      if (videoRef.current) videoRef.current.volume = 0.1;

      await playDingDong();

      let dest = data.roomName || data.unitType || '';
      
      // Jika nama ruangan mengandung kata Poli (misal "Poli 5B - dr. George"), ambil hanya "Poli 5B"
      const poliMatch = dest.match(/poli\s*\d+\s*[a-z]?/i);
      if (poliMatch) {
        dest = poliMatch[0];
      } else {
        // Hapus nama dokter (dr. atau drg.) yang mungkin ada di dalam kurung atau teks
        dest = dest.replace(/\(?dr\.\s*[a-zA-Z\s.,]+\)?/gi, '');
        dest = dest.replace(/\(?drg\.\s*[a-zA-Z\s.,]+\)?/gi, '');
        // Bersihkan sisa karakter seperti strip atau kurung
        dest = dest.replace(/[-()]/g, '').trim();
      }

      // Optimize pronunciation for TTS
      dest = dest.replace(/BDR/gi, 'B D R');

      const cleanTicketNo = data.ticketNo.replace(/[^a-zA-Z0-9]/g, '');
      const msg = `Nomor antrian. ${cleanTicketNo.split('').join(' ')}. silakan menuju ke. ${dest}.`;
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

  const loadData = useCallback(async () => {
    try {
      const res = await api.get(`/queue-tickets/floor-display/${floorNumber}`);
      setRecentBdr(res.data.recentBdr);
      setRecentPoli(res.data.recentPoli);
      setWaitingList(res.data.waitingList);
      if (res.data.recentPoli.length > 0 && res.data.recentBdr.length > 0) {
        const all = [...res.data.recentBdr, ...res.data.recentPoli].sort((a: any,b: any) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime());
        setCurrentCall(all[0]);
      } else if (res.data.recentPoli.length > 0) {
        setCurrentCall(res.data.recentPoli[0]);
      } else if (res.data.recentBdr.length > 0) {
        setCurrentCall(res.data.recentBdr[0]);
      }

      // Load Display Config (Video + Ticker)
      const dRes = await api.get(`/displays/code/${displayCode}`).catch(() => ({ data: null }));
      if (dRes.data?.runningText) setRunningText(dRes.data.runningText);
      if (dRes.data?.videoVolume !== undefined) setVideoVolume(dRes.data.videoVolume);

      // Load active videos for this specific display
      const videosRes = await api.get(`/video/active/${displayCode}`).catch(() => ({ data: [] }));
      const activeVideos = videosRes.data || [];
      if (activeVideos.length > 0) {
        setPlaylist(activeVideos);
      }
    } catch (err) {
      console.error(err);
    }
  }, [floorNumber, displayCode]);

  useEffect(() => {
    loadData();
    const dataInterval = setInterval(loadData, 5000);
    const socket = getSocket();

    socket.on('connect', () => {
      setConnected(true);
      joinDisplay(displayCode);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('settingUpdate', (data: any) => {
      if (data.type === 'TICKER' && data.text) setRunningText(data.text);
    });

    socket.on('playlistUpdate', (data: any) => {
      if (data && data.items) {
        setPlaylist(data.items);
        setCurrentVideoIdx(0);
      } else if (data && data.playlist) {
        setPlaylist(data.playlist);
        setCurrentVideoIdx(0);
      }
    });

    socket.on('playlistChanged', async () => {
      const videosRes = await api.get(`/video/active/${displayCode}`).catch(() => ({ data: [] }));
      const activeVideos = videosRes.data || [];
      setPlaylist(activeVideos);
      setCurrentVideoIdx(0);
    });

    socket.on('videoVolumeUpdate', (vol: number) => {
      setVideoVolume(vol);
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
      setTimeout(loadData, 2000);
    };

    socket.on('queueCall', handleQueueCall);

    const clockInterval = setInterval(() => setTime(new Date()), 1000);

    return () => {
      socket.off('queueCall', handleQueueCall);
      socket.off('settingUpdate');
      socket.off('playlistUpdate');
      socket.off('playlistChanged');
      socket.off('videoVolumeUpdate');
      socket.off('connect');
      socket.off('disconnect');
      clearInterval(clockInterval);
      clearInterval(dataInterval);
    };
  }, [displayCode, loadData, playBell]);

  if (!isAudioInit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #1e40af, #7c3aed)', color: 'white', cursor: 'pointer' }} onClick={initAudio}>
        <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>📺 TV Lantai {floorNumber} Siap</h1>
        <p style={{ fontSize: '1.5rem', opacity: 0.8 }}>Klik / Tap di mana saja untuk memulai (Aktivasi Suara)</p>
      </div>
    );
  }

  // Build duplicated list for seamless infinite scroll
  const renderWaitingItems = () => {
    if (waitingList.length === 0) {
      return <span className={styles.waitingBarEmpty}>Tidak ada antrian menunggu</span>;
    }

    const items = waitingList.map((w: any, idx: number) => (
      <div key={idx} className={styles.waitingBarItem}>
        <span className={styles.waitingBarNo}>{w.ticketNo}</span>
      </div>
    ));

    if (needsScroll) {
      // Duplicate items for seamless looping
      const duplicated = waitingList.map((w: any, idx: number) => (
        <div key={`dup-${idx}`} className={styles.waitingBarItem}>
          <span className={styles.waitingBarNo}>{w.ticketNo}</span>
        </div>
      ));
      return [...items, ...duplicated];
    }

    return items;
  };

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
          <div className={`${styles.dot} ${connected ? styles.online : styles.offline}`} title={connected ? 'Online' : 'Offline'}>
            {connected ? '●' : '○'}
          </div>
        </div>
      </div>

      {/* Main Content: Video + Call Cards */}
      <div className={styles.mainGrid}>
        {/* Video Area - takes most of the space */}
        <div className={styles.centerColumn}>
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
                onError={() => {
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
                <div className={styles.videoSub}>Video akan diputar di sini saat tidak ada panggilan</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Call Cards Only (no history) */}
        <div className={styles.rightColumn}>
          {/* BDR Call Card */}
          {recentBdr[0] ? (
            <div className={styles.currentCallCard} style={{ padding: '20px', borderRadius: '20px' }}>
              <div className={styles.currentLabel} style={{ fontSize: '0.85rem', marginBottom: '8px' }}>PANGGILAN BDR</div>
              <div className={styles.currentNo} style={{ fontSize: '3.5rem' }}>{recentBdr[0].ticketNo}</div>
            </div>
          ) : (
            <div className={styles.currentCallCard} style={{ opacity: 0.5, padding: '20px', borderRadius: '20px' }}>
              <div className={styles.currentDest} style={{ fontSize: '1rem', background: 'none', boxShadow: 'none' }}>Menunggu BDR...</div>
            </div>
          )}

          {/* POLI Call Card */}
          {recentPoli[0] ? (
            <div className={styles.currentCallCard} style={{ padding: '20px', borderRadius: '20px', background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)', boxShadow: '0 10px 40px rgba(234, 88, 12, 0.2)' }}>
              <div className={styles.currentLabel} style={{ fontSize: '0.85rem', marginBottom: '8px', color: '#ffedd5' }}>PANGGILAN POLI</div>
              <div className={styles.currentNo} style={{ fontSize: '3.5rem' }}>{recentPoli[0].ticketNo}</div>
              <div className={styles.currentDest} style={{ fontSize: '1.1rem', marginTop: '8px' }}>{recentPoli[0].roomName || (recentPoli[0] as any).targetRoom}</div>
            </div>
          ) : (
            <div className={styles.currentCallCard} style={{ opacity: 0.5, padding: '20px', borderRadius: '20px', background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' }}>
              <div className={styles.currentDest} style={{ fontSize: '1rem', background: 'none', boxShadow: 'none' }}>Menunggu POLI...</div>
            </div>
          )}
        </div>
      </div>

      {/* Waiting Bar - above ticker */}
      <div className={styles.waitingBar}>
        <div className={styles.waitingBarTitle}>
          Menunggu Dilayani
        </div>
        <div className={styles.waitingBarList}>
          <div 
            ref={waitingTrackRef}
            className={`${styles.waitingBarTrack} ${needsScroll ? styles.animated : ''}`}
            style={needsScroll ? { '--scroll-duration': `${scrollDuration}s` } as React.CSSProperties : undefined}
          >
            {renderWaitingItems()}
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
