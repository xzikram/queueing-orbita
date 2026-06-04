'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('orbita_token', res.data.access_token);
      localStorage.setItem('orbita_user', JSON.stringify(res.data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login gagal. Periksa kembali email dan password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Animated Background */}
      <div className={styles.bgPattern}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.orb3} />
        <div className={styles.orb4} />
        <div className={styles.gridOverlay} />
      </div>

      {/* Left Branding Panel */}
      <div className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <div className={styles.brandLogo}>
            <img src="/Logo RS JEC ORBITA.png" alt="JEC ORBITA" className={styles.brandLogoImg} />
          </div>
          <h1 className={styles.brandTitle}>Sistem Antrian Terpadu</h1>
          <p className={styles.brandSubtitle}>Queue Journey Management System</p>
          <div className={styles.brandFeatures}>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>🏥</span>
              <span>Multi-unit queue management</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>📊</span>
              <span>Real-time analytics & tracking</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>🔔</span>
              <span>Smart notification system</span>
            </div>
          </div>
        </div>
        <div className={styles.brandFooter}>
          <span>RS Mata JEC ORBITA @ Makassar</span>
        </div>
      </div>

      {/* Right Login Panel */}
      <div className={styles.loginPanel}>
        <div className={styles.loginCard}>
          {/* Mobile Logo */}
          <div className={styles.mobileLogo}>
            <img src="/Logo RS JEC ORBITA.png" alt="JEC ORBITA" className={styles.mobileLogoImg} />
          </div>

          <div className={styles.loginHeader}>
            <h2 className={styles.loginTitle}>Selamat Datang</h2>
            <p className={styles.loginSubtitle}>Silakan masuk ke akun Anda untuk melanjutkan</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.errorBox}>
                <span className={styles.errorIcon}>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className={styles.inputGroup}>
              <label className={styles.label}>Email / NIK</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>👤</span>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Masukkan email atau NIK"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Password</label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.togglePassword}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? (
                <span className={styles.spinner} />
              ) : null}
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <div className={styles.loginFooter}>
            <p>Powered by <strong>ORBITA Queue System</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
