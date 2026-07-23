'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getSocket, joinDisplay } from '@/lib/socket';
import api from '@/lib/api';
import styles from './farmasi.module.css';

interface CallData {
  ticketNo: string;
  patientName?: string;
  roomName?: string;
  unitType: string;
  calledAt: Date;
}

export default function DisplayFarmasiPage() {
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallData[]>([]);
  const [readyList, setReadyList] = useState<any[]>([]);
  const [runningText, setRunningText] = useState('Obat Anda sedang disiapkan. Silakan tunggu hingga nomor antrian dipanggil.');
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(0);
  const [time, setTime] = useState(new Date());
  const [connected, setConnected] = useState(false);
  const [isAudioInit, setIsAudioInit] = useState(false);
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

  const formatNameForTTS = (name: string): string => {
    if (!name) return '';
    let clean = name;

    // 1. Remove medical titles, academic degrees, and formal prefixes
    // Front titles: Dr., dr., DR., Drg., drg., Prof., Drs., Dra.
    clean = clean.replace(/(?:^|\s)(?:DR|Dr|dr|Drg|drg|Prof|Drs|Dra)\.?(?=\s|$)/gi, ' ');
    
    // Back degrees / Specializations: S.T., ST, S.E., SE, S.H., SH, S.Kep, S.Kom, S.Si, S.Sos, S.P, S.Ked, S.Farm, Sp.M, Sp.M(K), M.Kes, Ph.D, A.Md.Kep, etc.
    clean = clean.replace(/(?:,\s*|\s+)(?:Sp\.?\s*[A-Z]+(?:\([^)]+\))?|M\.?\s*Kes|Ph\.?D|MHPE|FFRI|S\.?\s*Kep|A\.?\s*Md(?:\.?\s*Kep)?|S\.?\s*[TEHSIKP]|Apt\.?)(?=\s|$|\.)/gi, ' ');

    // 2. Expand name abbreviations for clear Indonesian TTS reading
    // "St." / "St " / "ST." -> "Siti"
    clean = clean.replace(/(?:^|\s)(?:St|ST)\.?(?=\s+[a-zA-Z]|\s*$)/g, ' Siti ');
    // "Muh." / "Muh " -> "Muhammad"
    clean = clean.replace(/(?:^|\s)(?:Muh|MUH)\.?(?=\s+[a-zA-Z]|\s*$)/g, ' Muhammad ');
    // "Hj." / "Hj " -> "Hajjah"
    clean = clean.replace(/(?:^|\s)(?:Hj|HJ)\.?(?=\s+[a-zA-Z]|\s*$)/g, ' Hajjah ');
    // "H." / "H " -> "Haji"
    clean = clean.replace(/(?:^|\s)H\.(?=\s+[a-zA-Z]|\s*$)/g, ' Haji ');

    // 3. Remove punctuation, backticks, quotes, dots, commas, hyphens
    clean = clean.replace(/[`'"]/g, '');
    clean = clean.replace(/[.,_-]/g, ' ').replace(/\s+/g, ' ').trim();

    // 4. Convert to Title Case
    clean = clean.toLowerCase().replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());

    return clean;
  };

  const playBell = useCallback(async (data: CallData) => {
    try {
      if (videoRef.current) videoRef.current.volume = 0.1;

      await playDingDong();

      const rawName = data.patientName || '';
      const formattedName = rawName ? formatNameForTTS(rawName) : '';
      const nameToCall = formattedName ? `atas nama ${formattedName}` : `nomor antrean ${data.ticketNo.split('').join(' ')}`;
      const msg = `${nameToCall}, silakan menuju ke Loket Farmasi.`;

      // Cancel any ongoing speech before speaking
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(msg);
      utterance.lang = 'id-ID';
      
      const voices = window.speechSynthesis.getVoices();
      const idVoices = voices.filter(v => v.lang.startsWith('id') || v.lang.startsWith('ID') || v.name.toLowerCase().includes('indonesi'));
      const preferredVoice = idVoices.find(v => v.name.includes('Google') || v.name.includes('Ayu') || v.name.includes('Gadis') || v.name.toLowerCase().includes('female')) || idVoices[0];
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      utterance.rate = 0.95; // Slightly slower for natural clarity
      utterance.pitch = 1.0;

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
      const [callsRes, displayRes, videosRes, readyRes] = await Promise.all([
        api.get('/pharmacy/recent-calls?limit=8').catch(() => ({ data: [] })),
        api.get('/displays/code/display_farmasi').catch(() => ({ data: null })),
        api.get('/video/active/display_farmasi').catch(() => ({ data: [] })),
        api.get('/pharmacy/ready-list').catch(() => ({ data: [] })),
      ]);

      const calls = (callsRes.data || []).map((c: any) => ({
        ticketNo: c.ticketNo,
        patientName: c.visit?.patientName || undefined,
        roomName: c.targetRoom || 'Farmasi',
        unitType: c.unitType || 'PHARMACY',
        calledAt: c.calledAt,
      }));
      if (calls.length > 0) {
        setCurrentCall(calls[0]);
        setRecentCalls(calls.slice(1, 7));
      }

      setReadyList(readyRes.data || []);

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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    const dataInterval = setInterval(loadInitialData, 5000);
    const socket = getSocket();

    socket.on('connect', () => {
      setConnected(true);
      joinDisplay('display_farmasi');
    });

    socket.on('disconnect', () => setConnected(false));

    const handleQueueCall = (data: CallData) => {
      setCurrentCall(prev => {
        if (prev && prev.ticketNo !== data.ticketNo) {
          setRecentCalls(r => {
            if (r.length > 0 && r[0].ticketNo === prev.ticketNo) return r;
            return [prev, ...r].slice(0, 7);
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
      const videosRes = await api.get('/video/active/display_farmasi').catch(() => ({ data: [] }));
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
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #059669, #0d9488)', color: 'white', cursor: 'pointer' }} onClick={initAudio}>
        <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>💊 TV Farmasi Siap</h1>
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
            <h1 className={styles.headerTitle}>Farmasi</h1>
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

      <div className={styles.mainGrid}>
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
              <div className={styles.videoSub}>Upload video dari Dashboard untuk ditampilkan di sini</div>
            </div>
          )}
        </div>

        <div className={styles.rightColumn}>
          <div className={styles.currentCallSection}>
            {currentCall ? (
              <div className={styles.currentCallCard}>
                <div className={styles.callLabel}>AMBIL OBAT</div>
                {(() => {
                  const pName = currentCall.patientName || currentCall.ticketNo;
                  const nameLen = pName.length;
                  let fontSz = '2.8rem';
                  if (nameLen > 25) fontSz = '1.65rem';
                  else if (nameLen > 15) fontSz = '2.1rem';
                  else if (nameLen > 8) fontSz = '2.5rem';

                  return (
                    <div 
                      className={styles.callNumber}
                      style={{ 
                        fontSize: fontSz,
                        wordBreak: 'normal',
                        overflowWrap: 'break-word',
                        lineHeight: '1.25',
                        padding: '12px 8px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: '#1e3a8a',
                        minHeight: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {pName}
                    </div>
                  );
                })()}
                <div className={styles.callArrow}>→</div>
                <div className={styles.callCounter}>Loket Farmasi</div>
              </div>
            ) : (
              <div className={styles.noCall}>
                <div className={styles.noCallIcon}>💊</div>
                <div className={styles.noCallText}>Menunggu Panggilan...</div>
              </div>
            )}
          </div>

          <div className={styles.recentSection}>
            <h3 className={styles.recentTitle}>Obat Siap Ambil</h3>
            <div className={styles.recentList} style={{ overflowY: 'auto', flex: 1 }}>
              {readyList.length === 0 ? (
                <div className={styles.recentEmpty}>Belum ada antrean obat siap</div>
              ) : (
                readyList.map((item: any, idx) => {
                  const pName = item.patientName || item.doctorTicketNo || item.queueTicket?.ticketNo || 'Pasien';
                  const docName = item.selectedDoctor?.doctorName || '';
                  return (
                    <div key={idx} className={styles.recentItem} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '8px', background: '#ecfdf5' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#065f46', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>
                        🟢 {pName}
                      </span>
                      {docName && (
                        <span style={{ fontSize: '0.95rem', color: '#047857', fontWeight: 600 }}>
                          {docName}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.ticker}>
        <div className={styles.tickerContent}>
          <span>{runningText}</span>
        </div>
      </div>
    </div>
  );
}
