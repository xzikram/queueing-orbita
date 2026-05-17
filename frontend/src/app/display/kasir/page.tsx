'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DisplayKasirPage() {
  const router = useRouter();

  useEffect(() => {
    // Display Kasir sudah digabung ke Display Admisi
    router.replace('/display/admisi');
  }, [router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1e40af', color: 'white' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '16px' }}>Mengalihkan...</h1>
        <p style={{ opacity: 0.8 }}>Display Kasir telah digabung ke Display Admisi</p>
      </div>
    </div>
  );
}
