'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';

export default function AppointmentTrackingPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [trackingData, setTrackingData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load active doctor schedules for today
  useEffect(() => {
    api.get('/schedules/active-today')
      .then(res => {
        setSchedules(res.data || []);
        if (res.data && res.data.length > 0) {
          setSelectedScheduleId(res.data[0].id);
        }
      })
      .catch(err => {
        console.error('Failed to load schedules', err);
      });
  }, []);

  // Fetch tracking data for selected schedule
  const fetchTracking = useCallback(async () => {
    if (!selectedScheduleId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/schedules/appointment-tracking?scheduleId=${selectedScheduleId}`);
      setTrackingData(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Gagal memuat data tracking kedatangan');
    } finally {
      setLoading(false);
    }
  }, [selectedScheduleId]);

  useEffect(() => {
    fetchTracking();

    const socket = getSocket();
    const handleRefresh = () => {
      fetchTracking();
    };

    socket.on('dashboardRefresh', handleRefresh);
    socket.on('queueUpdate', handleRefresh);

    const interval = setInterval(fetchTracking, 10000);

    return () => {
      clearInterval(interval);
      socket.off('dashboardRefresh', handleRefresh);
      socket.off('queueUpdate', handleRefresh);
    };
  }, [fetchTracking]);

  const summary = trackingData?.summary || { totalAppointments: 0, arrivedCount: 0, notArrivedCount: 0 };
  const doctor = trackingData?.doctor;
  const room = trackingData?.room;
  const list = trackingData?.appointments || [];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            🎯 Live Appointment Arrival Tracking
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '4px' }}>
            Pantau status kedatangan pasien janji SIMRS secara realtime di Admisi & Unit Pelayanan
          </p>
        </div>

        {/* Schedule Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', padding: '8px 16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>Pilih Dokter / Jadwal:</label>
          <select
            value={selectedScheduleId}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem', background: '#f8fafc', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
          >
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.doctor?.doctorName} — Poli {s.room?.name} ({s.shiftName || 'Praktik'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {doctor && (
        <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '16px', padding: '20px 24px', color: '#fff', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#38bdf8' }}>INFO JADWAL AKTIF</span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '4px 0 2px 0' }}>{doctor.doctorName}</h2>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: '#94a3b8' }}>
              <span>🏢 Poli: <strong style={{ color: '#e2e8f0' }}>{room?.name || '-'}</strong></span>
              <span>🏷️ Prefix Dokter: <strong style={{ color: '#38bdf8' }}>{doctor.doctorInitials || doctor.doctorCode || '-'}</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', padding: '12px 20px', borderRadius: '12px', textAlign: 'center', minWidth: '110px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>{summary.totalAppointments}</div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Total Janji</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px 20px', borderRadius: '12px', textAlign: 'center', minWidth: '110px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>{summary.arrivedCount}</div>
              <div style={{ fontSize: '0.75rem', color: '#a7f3d0' }}>Sudah Datang</div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '12px 20px', borderRadius: '12px', textAlign: 'center', minWidth: '110px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>{summary.notArrivedCount}</div>
              <div style={{ fontSize: '0.75rem', color: '#fde68a' }}>Belum Datang</div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '14px 18px', borderRadius: '12px', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main Data Table Card */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            📋 Daftar Pasien Janji SIMRS ({list.length})
          </h3>
          <button
            onClick={fetchTracking}
            disabled={loading}
            style={{ padding: '6px 14px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
          >
            {loading ? '🔄 Memuat...' : '🔄 Refresh Data'}
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                <th style={{ padding: '14px 20px' }}>No. Antrean Dokter</th>
                <th style={{ padding: '14px 20px' }}>Nama Pasien</th>
                <th style={{ padding: '14px 20px' }}>No. RM</th>
                <th style={{ padding: '14px 20px' }}>Jam Janji</th>
                <th style={{ padding: '14px 20px' }}>Channel</th>
                <th style={{ padding: '14px 20px' }}>Status Kedatangan</th>
                <th style={{ padding: '14px 20px' }}>Tiket Admisi</th>
                <th style={{ padding: '14px 20px' }}>Posisi Unit</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    {loading ? 'Memuat data kedatangan...' : 'Tidak ada data janji temu untuk jadwal ini.'}
                  </td>
                </tr>
              ) : (
                list.map((item: any, idx: number) => {
                  const isArrived = item.isArrived;
                  const currentUnit = item.registration?.currentUnitType;
                  const currentStatus = item.registration?.currentStatus;

                  let statusBadge = (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                      ⚪ BELUM DATANG
                    </span>
                  );

                  if (isArrived) {
                    if (currentStatus === 'FINISHED') {
                      statusBadge = (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                          ✅ SELESAI BEROBAT
                        </span>
                      );
                    } else if (currentUnit === 'DOCTOR') {
                      statusBadge = (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                          👨‍⚕️ DI POLIKLINIK DOKTER
                        </span>
                      );
                    } else if (currentUnit === 'ASSESSMENT') {
                      statusBadge = (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#cff4fc', color: '#055160', border: '1px solid #9eeaf9', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                          📋 DI PENGKAJIAN PERAWAT
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }}>
                          🏥 PROSES ADMISI
                        </span>
                      );
                    }
                  }

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: isArrived ? '#faf5ff' : '#ffffff' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 800, color: '#2563eb', fontSize: '1rem' }}>
                        {item.formattedDoctorTicketNo}
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: '#0f172a' }}>
                        {item.PatientName || '-'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#475569', fontFamily: 'monospace' }}>
                        {item.MedicalNo || '-'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#334155', fontWeight: 600 }}>
                        ⏰ {item.AppointmentTime || '-'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#64748b' }}>
                        {item.RegistrationChannel || 'SIMRS'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {statusBadge}
                      </td>
                      <td style={{ padding: '14px 20px', fontWeight: 600, color: '#475569' }}>
                        {item.queueTicketNo ? (
                          <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                            🎫 {item.queueTicketNo}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#475569' }}>
                        {currentUnit ? (
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{currentUnit}</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
