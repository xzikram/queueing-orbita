import React from 'react';
import Image from 'next/image';

interface LogoProps {
  size?: number;
}

export default function Logo({ size = 40 }: LogoProps) {
  // Ganti '/logo.png' dengan nama file logo Anda di folder public
  // Pastikan Anda sudah memindahkan file logo Anda ke frontend/public/
  const logoPath = '/logo.png'; 

  // Fallback ke SVG bawaan jika logo.png tidak ditemukan (opsional, tapi untuk keamanan)
  // Anda bisa langsung menggunakan <img src="/logo.png" /> jika sudah ada
  
  return (
    <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* 
        Ini akan membaca file public/logo.png
        Hapus fallback SVG jika Anda sudah memiliki logo.png
      */}
      <img 
        src={logoPath} 
        alt="Logo" 
        width={size} 
        height={size} 
        style={{ objectFit: 'contain', maxWidth: '100%', maxHeight: '100%' }}
        onError={(e) => {
          // Fallback jika file logo.png belum ada
          (e.target as any).style.display = 'none';
          (e.target as any).nextElementSibling.style.display = 'block';
        }}
      />
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" style={{ display: 'none' }}>
        <circle cx="20" cy="20" r="18" stroke="url(#gradSb)" strokeWidth="3" />
        <path d="M14 20h12M20 14v12" stroke="url(#gradSb)" strokeWidth="2.5" strokeLinecap="round" />
        <defs>
          <linearGradient id="gradSb" x1="0" y1="0" x2="40" y2="40">
            <stop stopColor="#2563eb" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
