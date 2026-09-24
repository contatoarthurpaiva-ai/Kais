import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kais — Gestão',
  description: 'Gestão financeira e precificação da Kais',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
