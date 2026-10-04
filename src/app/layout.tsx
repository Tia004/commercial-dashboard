import type { Metadata } from 'next';
import './globals.css';
import { CRMProvider } from '@/lib/store';
import { AuthProvider } from '@/lib/auth';
import { GlowPointerListener } from '@/components/GlowPointerListener';

export const metadata: Metadata = {
  title: 'Hub Commerciale | Workspace vendite',
  description:
    'Workspace per gestire opportunità, attività e priorità commerciali di tutti i tuoi brand.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" data-theme="slate">
      <body className="antialiased min-h-screen">
        <GlowPointerListener />
        <AuthProvider>
          <CRMProvider>{children}</CRMProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
