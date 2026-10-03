'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserPasskey {
  id: string;
  name: string;
  createdAt: string;
  rawId: string;
  type: string;
  transports?: string[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  brandScope: string[]; // e.g. ['NoLimits', 'Webissimo', 'Sapori']
  hasPasskey: boolean;
  passkeys: UserPasskey[];
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  loginWithPassword: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerUser: (name: string, email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  // Passkey operations
  isPasskeySupported: boolean;
  registerPasskey: (passkeyName?: string) => Promise<{ success: boolean; error?: string; passkey?: UserPasskey }>;
  loginWithPasskey: () => Promise<{ success: boolean; error?: string }>;
  removePasskey: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_USER = 'hubc_crm_auth_user_v1';
const LOCAL_STORAGE_KEY_PASSKEYS = 'hubc_crm_passkeys_v1';

const DEFAULT_USER: AuthUser = {
  id: 'usr-1',
  name: 'Alessandro Rossi',
  email: 'a.rossi@omnihub.commerciale.it',
  role: 'Executive VP Sales (Admin)',
  brandScope: ['NoLimits', 'Webissimo', 'Sapori'],
  hasPasskey: false,
  passkeys: [],
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(DEFAULT_USER);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isPasskeySupported, setIsPasskeySupported] = useState<boolean>(false);

  useEffect(() => {
    // Check WebAuthn support
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setIsPasskeySupported(available))
        .catch(() => setIsPasskeySupported(false));
    }

    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_USER);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  const saveUser = (u: AuthUser | null) => {
    setUser(u);
    try {
      if (u) {
        localStorage.setItem(LOCAL_STORAGE_KEY_USER, JSON.stringify(u));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_USER);
      }
    } catch (e) {}
  };

  const loginWithPassword = async (email: string, pass: string) => {
    if (!email || !pass) return { success: false, error: 'Inserisci email e password' };
    const loggedUser: AuthUser = {
      id: `usr-${Date.now()}`,
      name: email.split('@')[0].replace('.', ' ').toUpperCase(),
      email,
      role: 'Direttore Commerciale',
      brandScope: ['NoLimits', 'Webissimo', 'Sapori'],
      hasPasskey: (user?.passkeys.length || 0) > 0,
      passkeys: user?.passkeys || [],
    };
    saveUser(loggedUser);
    setIsAuthModalOpen(false);
    return { success: true };
  };

  const registerUser = async (name: string, email: string, pass: string) => {
    if (!name || !email || !pass) return { success: false, error: 'Compila tutti i campi obbligatori' };
    const newUser: AuthUser = {
      id: `usr-${Date.now()}`,
      name,
      email,
      role: 'Sales Representative',
      brandScope: ['NoLimits', 'Webissimo', 'Sapori'],
      hasPasskey: false,
      passkeys: [],
    };
    saveUser(newUser);
    setIsAuthModalOpen(false);
    return { success: true };
  };

  const logout = () => {
    saveUser(null);
  };

  // Register Passkey via native WebAuthn (Touch ID / Windows Hello)
  const registerPasskey = async (passkeyName?: string): Promise<{ success: boolean; error?: string; passkey?: UserPasskey }> => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return { success: false, error: 'WebAuthn non supportato su questo dispositivo/browser' };
    }

    try {
      // Challenge and user ID
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const deviceLabel =
        passkeyName ||
        (navigator.userAgent.includes('Mac')
          ? 'Touch ID (macOS)'
          : navigator.userAgent.includes('Windows')
          ? 'Windows Hello'
          : 'Chiave di Sicurezza Biometrica');

      const credentialCreationOptions: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: {
            name: 'Hub Commerciale - Omnihub Sales CRM',
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: user?.email || 'utente@commerciale.it',
            displayName: user?.name || 'Utente Hub Commerciale',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Touch ID / Windows Hello
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      };

      const credential = (await navigator.credentials.create(
        credentialCreationOptions
      )) as PublicKeyCredential | null;

      if (!credential) {
        return { success: false, error: 'Creazione della Passkey annullata' };
      }

      const newPasskey: UserPasskey = {
        id: `pk-${Date.now()}`,
        name: deviceLabel,
        createdAt: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        rawId: credential.id,
        type: credential.type,
      };

      if (user) {
        const updatedUser = {
          ...user,
          hasPasskey: true,
          passkeys: [newPasskey, ...user.passkeys],
        };
        saveUser(updatedUser);
      }

      return { success: true, passkey: newPasskey };
    } catch (err: any) {
      return { success: false, error: err.message || 'Errore durante la registrazione biometrica' };
    }
  };

  // Login using registered Passkey
  const loginWithPasskey = async (): Promise<{ success: boolean; error?: string }> => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return { success: false, error: 'WebAuthn non supportato su questo dispositivo' };
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credentialRequestOptions: CredentialRequestOptions = {
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 60000,
        },
      };

      const assertion = await navigator.credentials.get(credentialRequestOptions);
      if (!assertion) {
        return { success: false, error: 'Autenticazione biometrica annullata' };
      }

      // Successful verification
      if (!user) {
        saveUser(DEFAULT_USER);
      }
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verifica Passkey fallita' };
    }
  };

  const removePasskey = (id: string) => {
    if (!user) return;
    const filtered = user.passkeys.filter((p) => p.id !== id);
    saveUser({
      ...user,
      passkeys: filtered,
      hasPasskey: filtered.length > 0,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authMode,
        setAuthMode,
        loginWithPassword,
        registerUser,
        logout,
        isPasskeySupported,
        registerPasskey,
        loginWithPasskey,
        removePasskey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
