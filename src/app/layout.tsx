import type { Metadata } from 'next';
import './globals.css';
import './workspace.css';
import 'leaflet/dist/leaflet.css';
import { CRMProvider } from '@/lib/store';
import { AuthProvider } from '@/lib/auth';
import { ContactsProvider } from '@/lib/contacts';
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
    <html lang="it" data-theme="slate" className="dark">
      <body className="antialiased">
        <GlowPointerListener />
        <AuthProvider>
          <CRMProvider><ContactsProvider>{children}</ContactsProvider></CRMProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
