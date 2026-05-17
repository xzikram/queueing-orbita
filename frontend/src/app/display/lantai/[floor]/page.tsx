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
  const [isAudioInit, setIsAudioInit] = useState(false);
  // Video & Ticker state
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
  const [runningText, setRunningText] = useState(`Selamat datang di RS JEC ORBITA — Lantai ${floorNumber}. Mohon menunggu nomor antrian Anda dipanggil. • Selalu patuhi protokol kesehatan.`);
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

      const dest = data.roomName || data.unitType;
      const msg = `Nomor antrian. ${data.ticketNo.split('').join(' ')}. silakan menuju ke. ${dest}.`;
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

          {/* Bottom Section: Waiting List */}
          <div className={styles.waitingSection}>
            <div className={styles.sectionTitle}>Menunggu Dilayani di Lantai {floorNumber}</div>
            <div className={styles.waitingGrid}>
              {waitingList.length === 0 ? (
                <div className={styles.emptySection}>Tidak ada antrian</div>
              ) : (
                waitingList.map((w: any, idx: number) => (
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
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '24px', backgroundColor: '#000' }}
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
