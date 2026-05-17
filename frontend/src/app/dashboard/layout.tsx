'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import styles from './dashboard.module.css';
import Logo from '@/components/Logo';

const menuItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊', roles: ['ADMIN', 'MANAGEMENT'] },
  { label: 'Admisi', path: '/dashboard/admission', icon: '🏥', roles: ['ADMIN', 'ADMISSION'] },
  { label: 'Pengkajian', path: '/dashboard/assessment', icon: '📋', roles: ['ADMIN', 'ASSESSMENT'] },
  { label: 'BDR', path: '/dashboard/bdr', icon: '💉', roles: ['ADMIN', 'BDR'] },
  { label: 'Dokter/Poli', path: '/dashboard/doctor', icon: '👨‍⚕️', roles: ['ADMIN', 'DOCTOR'] },
  { label: 'CDC', path: '/dashboard/cdc', icon: '🔬', roles: ['ADMIN', 'CDC'] },
  { label: 'Kasir', path: '/dashboard/cashier', icon: '💳', roles: ['ADMIN', 'CASHIER'] },
  { label: 'Farmasi', path: '/dashboard/pharmacy', icon: '💊', roles: ['ADMIN', 'PHARMACY'] },
  { label: 'Optik', path: '/dashboard/optic', icon: '👓', roles: ['ADMIN', 'OPTIC'] },
  { type: 'divider' },
  { label: 'Counter Management', path: '/dashboard/counter-management', icon: '🔧', roles: ['ADMIN', 'KEPALA_ADMISI'] },
  { type: 'divider' },
  { label: 'Master Data', icon: '⚙️', roles: ['ADMIN'], children: [
    { label: 'Users', path: '/dashboard/master/users', icon: '👤' },
    { label: 'Dokter', path: '/dashboard/master/doctors', icon: '🩺' },
    { label: 'Ruangan', path: '/dashboard/master/rooms', icon: '🚪' },
    { label: 'Counter', path: '/dashboard/master/counters', icon: '🖥️' },
    { label: 'Display', path: '/dashboard/master/displays', icon: '📺' },
    { label: 'Video Playlists', path: '/dashboard/master/videos', icon: '🎬' },
  ]},
  { label: 'Jadwal Dokter', path: '/dashboard/schedules', icon: '📅', roles: ['ADMIN'] },
  { type: 'divider' },
  { label: 'Live Dashboard', path: '/dashboard/live', icon: '📈', roles: ['ADMIN', 'MANAGEMENT'] },
  { label: 'Analytics Reports', path: '/dashboard/reports', icon: '📉', roles: ['ADMIN', 'MANAGEMENT'] },
  { label: 'Audit Logs', path: '/dashboard/audit', icon: '🛡️', roles: ['ADMIN', 'MANAGEMENT'] },
  { type: 'divider' },
  { label: 'TV Display', icon: '📺', roles: ['ADMIN'], children: [
    { label: 'TV Admisi & Kasir', path: '/display/admisi', icon: '📺', external: true },
    { label: 'TV Lantai 5', path: '/display/lantai/5', icon: '📺', external: true },
    { label: 'TV Lantai 6', path: '/display/lantai/6', icon: '📺', external: true },
    { label: 'TV Lantai 7', path: '/display/lantai/7', icon: '📺', external: true },
    { label: 'TV Farmasi', path: '/display/farmasi', icon: '💊', external: true },
  ]},
  { label: 'Kiosk Admisi', path: '/kiosk', icon: '🎫', roles: ['ADMIN', 'QUEUE_OFFICER'], external: true },
  { label: 'Kiosk Kasir', path: '/kiosk/kasir', icon: '🧾', roles: ['ADMIN', 'QUEUE_OFFICER', 'KEPALA_ADMISI'], external: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem('orbita_user');
    if (!stored) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('orbita_token');
    localStorage.removeItem('orbita_user');
    localStorage.removeItem('activeDoctorRoom');
    router.push('/login');
  };

  const toggleMenu = (label: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  if (!user) return null;

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          {!collapsed ? (
            <img src="/logo.png" alt="Orbita Queue" className={styles.sidebarFullLogo} />
          ) : (
            <div className={styles.brandLogo}>
              <Logo size={28} />
            </div>
          )}
        </div>

        <nav className={styles.nav}>
          {menuItems.map((item: any, idx) => {
            if (item.type === 'divider') {
              return <div key={idx} className={styles.divider} />;
            }

            if (item.roles && !item.roles.includes(user.role)) return null;

            if (item.children) {
              const isExpanded = expandedMenus.has(item.label);
              return (
                <div key={item.label}>
                  <button
                    className={styles.menuItem}
                    onClick={() => toggleMenu(item.label)}
                  >
                    <span className={styles.menuIcon}>{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className={styles.menuLabel}>{item.label}</span>
                        <span className={`${styles.arrow} ${isExpanded ? styles.arrowOpen : ''}`}>›</span>
                      </>
                    )}
                  </button>
                  {isExpanded && !collapsed && (
                    <div className={styles.submenu}>
                      {item.children.map((child: any) => (
                        <a
                          key={child.path}
                          href={child.path}
                          target={child.external ? '_blank' : undefined}
                          className={`${styles.menuItem} ${styles.submenuItem} ${pathname === child.path ? styles.active : ''}`}
                          onClick={(e) => {
                            if (!child.external) {
                              e.preventDefault();
                              router.push(child.path);
                            }
                          }}
                        >
                          <span className={styles.menuIcon}>{child.icon}</span>
                          <span className={styles.menuLabel}>{child.label}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <a
                key={item.path}
                href={item.path}
                target={item.external ? '_blank' : undefined}
                className={`${styles.menuItem} ${pathname === item.path ? styles.active : ''}`}
                onClick={(e) => {
                  if (!item.external) {
                    e.preventDefault();
                    router.push(item.path);
                  }
                }}
              >
                <span className={styles.menuIcon}>{item.icon}</span>
                {!collapsed && <span className={styles.menuLabel}>{item.label}</span>}
              </a>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.collapseBtn} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.pageTitle}>
              {pathname === '/dashboard' ? 'Dashboard' : 
               pathname.includes('/admission') ? 'Admisi' :
               pathname.includes('/master') ? 'Master Data' :
               pathname.includes('/schedules') ? 'Jadwal Dokter' :
               'Orbita Queue'}
            </h2>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.name}</span>
              <span className="badge badge-primary">{user.role}</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
