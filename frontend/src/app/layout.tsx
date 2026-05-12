import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Orbita Queue — Queue Journey Management System',
  description: 'Sistem manajemen perjalanan pasien klinik/rumah sakit',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
