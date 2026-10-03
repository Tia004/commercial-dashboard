import type { Metadata } from 'next';
import './globals.css';
import { CRMProvider } from '@/lib/store';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Hub Commerciale - Executive Multi-Brand CRM & AI Sales Copilot',
  description:
    'Dashboard commerciale unica per centralizzare e gestire le vendite di NoLimits, Webissimo e Sapori con Agente AI autonomo e server MCP integrato.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">
        <AuthProvider>
          <CRMProvider>{children}</CRMProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
