'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';
import styles from './dashboard.module.css';
import Logo from '@/components/Logo';

const menuItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊', permissionKey: 'dashboard' },
  { label: 'Admisi & Kasir', path: '/dashboard/front-desk', icon: '🛎️', permissionKeys: ['admission', 'cashier'] },
  { label: 'Pengkajian', path: '/dashboard/assessment', icon: '📋', permissionKey: 'assessment' },
  { label: 'BDR', path: '/dashboard/bdr', icon: '💉', permissionKey: 'bdr' },
  { label: 'Dokter/Poli', path: '/dashboard/doctor', icon: '👨‍⚕️', permissionKey: 'doctor' },
  { label: 'CDC', path: '/dashboard/cdc', icon: '🔬', permissionKey: 'cdc' },
  { label: 'Farmasi', path: '/dashboard/pharmacy', icon: '💊', permissionKey: 'pharmacy' },
  { label: 'Optik', path: '/dashboard/optic', icon: '👓', permissionKey: 'optic' },
  { type: 'divider' },
  { label: 'Master Data', icon: '⚙️', permissionKey: 'master', children: [
    { label: 'Users', path: '/dashboard/master/users', icon: '👤' },
    { label: 'Akses Group', path: '/dashboard/master/access-groups', icon: '🔐' },
    { label: 'Dokter', path: '/dashboard/master/doctors', icon: '🩺' },
    { label: 'Ruangan', path: '/dashboard/master/rooms', icon: '🚪' },
    { label: 'Counter', path: '/dashboard/master/counters', icon: '🖥️' },
    { label: 'Display', path: '/dashboard/master/displays', icon: '📺' },
    { label: 'Video Playlists', path: '/dashboard/master/videos', icon: '🎬' },
  ]},
  { label: 'Jadwal Dokter', path: '/dashboard/schedules', icon: '📅', permissionKey: 'schedules' },
  { type: 'divider' },
  { label: 'Live Dashboard', path: '/dashboard/live', icon: '📈', permissionKey: 'live' },
  { label: 'Analytics Reports', path: '/dashboard/reports', icon: '📉', permissionKey: 'reports' },
  { label: 'Tracking Pasien', path: '/dashboard/reports/journey', icon: '🔍', permissionKey: 'reports' },
  { label: 'Audit Logs', path: '/dashboard/audit', icon: '🛡️', permissionKey: 'audit' },
  { type: 'divider' },
  { label: 'TV Display', icon: '📺', permissionKey: 'master', children: [
    { label: 'TV Admisi & Kasir', path: '/display/admisi', icon: '📺', external: true },
    { label: 'TV Lantai 5', path: '/display/lantai/5', icon: '📺', external: true },
    { label: 'TV Lantai 6', path: '/display/lantai/6', icon: '📺', external: true },
    { label: 'TV Lantai 7', path: '/display/lantai/7', icon: '📺', external: true },
    { label: 'TV Farmasi', path: '/display/farmasi', icon: '💊', external: true },
  ]},
  { label: 'Kiosk Admisi', path: '/kiosk', icon: '🎫', permissionKey: 'admission', external: true },
  { label: 'Kiosk Kasir', path: '/kiosk/kasir', icon: '🧾', permissionKey: 'cashier', external: true },
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
    
    // Set user dari localstorage dulu biar cepat tampil
    setUser(JSON.parse(stored));
    
    // Sync ke server untuk update permission terbaru jika diubah oleh admin
    api.get('/auth/me').then(res => {
      setUser(res.data);
      localStorage.setItem('orbita_user', JSON.stringify(res.data));
    }).catch(err => {
      console.error('Failed to sync user data', err);
    });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('orbita_token');
    localStorage.removeItem('orbita_user');
    localStorage.removeItem('activeDoctorRoom');
    localStorage.removeItem('activeAdmissionCounter');
    localStorage.removeItem('activeCashierCounter');
    localStorage.removeItem('activeBdrFloor');
    localStorage.removeItem('activeAssessmentFloor');
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

            // Permission-based filtering: check user's permissions from access group
            const userPermissions: string[] = user.permissions || [];
            const isAdmin = user.role === 'ADMIN';

            const hasPermission = isAdmin || (
              item.permissionKey ? userPermissions.includes(item.permissionKey) : 
              item.permissionKeys ? item.permissionKeys.some((k: string) => userPermissions.includes(k)) : true
            );

            if (!hasPermission) return null;

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
