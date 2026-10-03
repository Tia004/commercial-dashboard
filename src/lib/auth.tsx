'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserPasskey {
  id: string;
  name: string;
  createdAt: string;
  rawId: string;
  type: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  company?: string;
  role: string;
  hasPasskey: boolean;
  passkeys: UserPasskey[];
}

interface StoredUserAccount extends AuthUser {
  passwordHash: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  loginWithPassword: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerUser: (name: string, email: string, pass: string, company?: string, role?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  // Passkey operations
  isPasskeySupported: boolean;
  registerPasskey: (passkeyName?: string) => Promise<{ success: boolean; error?: string; passkey?: UserPasskey }>;
  loginWithPasskey: () => Promise<{ success: boolean; error?: string }>;
  removePasskey: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_CURRENT_USER = 'hubc_crm_current_user_v2';
const LOCAL_STORAGE_KEY_ACCOUNTS_DB = 'hubc_crm_registered_accounts_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // USER STARTS NULL (NOT LOGGED IN)
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isPasskeySupported, setIsPasskeySupported] = useState<boolean>(false);

  // Load current session from localStorage
  useEffect(() => {
    // Check WebAuthn support
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setIsPasskeySupported(available))
        .catch(() => setIsPasskeySupported(false));
    }

    try {
      const savedUser = localStorage.getItem(LOCAL_STORAGE_KEY_CURRENT_USER);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (e) {}
  }, []);

  const getAccountsDB = (): StoredUserAccount[] => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_ACCOUNTS_DB);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  };

  const saveAccountsDB = (accounts: StoredUserAccount[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_ACCOUNTS_DB, JSON.stringify(accounts));
    } catch (e) {}
  };

  const saveCurrentUser = (u: AuthUser | null) => {
    setUser(u);
    try {
      if (u) {
        localStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_USER, JSON.stringify(u));
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY_CURRENT_USER);
      }
    } catch (e) {}
  };

  // Real Login with Email and Password
  const loginWithPassword = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    if (!email.trim() || !pass.trim()) {
      return { success: false, error: 'Inserisci sia email che password.' };
    }

    const accounts = getAccountsDB();
    const existing = accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());

    if (!existing) {
      return {
        success: false,
        error: 'Nessun account trovato con questa email. Registrati per iniziare.',
      };
    }

    if (existing.passwordHash !== pass) {
      return { success: false, error: 'Password non corretta. Riprova.' };
    }

    const sessionUser: AuthUser = {
      id: existing.id,
      name: existing.name,
      email: existing.email,
      company: existing.company,
      role: existing.role,
      hasPasskey: existing.passkeys && existing.passkeys.length > 0,
      passkeys: existing.passkeys || [],
    };

    saveCurrentUser(sessionUser);
    setIsAuthModalOpen(false);
    return { success: true };
  };

  // Real Registration
  const registerUser = async (
    name: string,
    email: string,
    pass: string,
    company?: string,
    role?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!name.trim() || !email.trim() || !pass.trim()) {
      return { success: false, error: 'Compila tutti i campi obbligatori (Nome, Email, Password).' };
    }

    if (pass.length < 6) {
      return { success: false, error: 'La password deve contenere almeno 6 caratteri.' };
    }

    const accounts = getAccountsDB();
    const alreadyExists = accounts.some((a) => a.email.toLowerCase() === email.trim().toLowerCase());

    if (alreadyExists) {
      return { success: false, error: 'Esiste già un account con questa email. Accedi invece di registrarti.' };
    }

    const newAccount: StoredUserAccount = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() || 'Azienda Commerciale',
      role: role?.trim() || 'Sales Director',
      passwordHash: pass,
      hasPasskey: false,
      passkeys: [],
    };

    saveAccountsDB([...accounts, newAccount]);

    const sessionUser: AuthUser = {
      id: newAccount.id,
      name: newAccount.name,
      email: newAccount.email,
      company: newAccount.company,
      role: newAccount.role,
      hasPasskey: false,
      passkeys: [],
    };

    saveCurrentUser(sessionUser);
    setIsAuthModalOpen(false);
    return { success: true };
  };

  const logout = () => {
    saveCurrentUser(null);
  };

  // Register Passkey with WebAuthn
  const registerPasskey = async (
    passkeyName?: string
  ): Promise<{ success: boolean; error?: string; passkey?: UserPasskey }> => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return { success: false, error: 'WebAuthn non supportato su questo dispositivo/browser' };
    }

    if (!user) {
      return { success: false, error: 'Devi prima aver effettuato l\'accesso con un account per registrare una passkey.' };
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(user.id);

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
            name: 'Hub Commerciale - CRM',
            id: window.location.hostname,
          },
          user: {
            id: userId,
            name: user.email,
            displayName: user.name,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
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
        return { success: false, error: 'Creazione Passkey annullata.' };
      }

      const newPasskey: UserPasskey = {
        id: `pk-${Date.now()}`,
        name: deviceLabel,
        createdAt: new Date().toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        rawId: credential.id,
        type: credential.type,
      };

      const updatedUser: AuthUser = {
        ...user,
        hasPasskey: true,
        passkeys: [newPasskey, ...user.passkeys],
      };

      // Update in accounts DB
      const accounts = getAccountsDB();
      const updatedAccounts = accounts.map((acc) =>
        acc.id === user.id ? { ...acc, passkeys: updatedUser.passkeys, hasPasskey: true } : acc
      );
      saveAccountsDB(updatedAccounts);
      saveCurrentUser(updatedUser);

      return { success: true, passkey: newPasskey };
    } catch (err: any) {
      return { success: false, error: err.message || 'Errore durante la registrazione biometrica' };
    }
  };

  // Login with Passkey
  const loginWithPasskey = async (): Promise<{ success: boolean; error?: string }> => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return { success: false, error: 'WebAuthn non supportato su questo dispositivo.' };
    }

    const accounts = getAccountsDB();
    const accountsWithPasskey = accounts.filter((a) => a.passkeys && a.passkeys.length > 0);

    if (accountsWithPasskey.length === 0) {
      return {
        success: false,
        error: 'Nessuna Passkey registrata trovata. Accedi prima con password e registra la tua Passkey dalle impostazioni.',
      };
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

      const assertion = (await navigator.credentials.get(credentialRequestOptions)) as PublicKeyCredential | null;
      if (!assertion) {
        return { success: false, error: 'Verifica biometrica annullata.' };
      }

      // Match credential id
      const matchedAccount = accountsWithPasskey.find((a) =>
        a.passkeys.some((pk) => pk.rawId === assertion.id)
      ) || accountsWithPasskey[0];

      const sessionUser: AuthUser = {
        id: matchedAccount.id,
        name: matchedAccount.name,
        email: matchedAccount.email,
        company: matchedAccount.company,
        role: matchedAccount.role,
        hasPasskey: true,
        passkeys: matchedAccount.passkeys,
      };

      saveCurrentUser(sessionUser);
      setIsAuthModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verifica Passkey fallita.' };
    }
  };

  const removePasskey = (id: string) => {
    if (!user) return;
    const filtered = user.passkeys.filter((p) => p.id !== id);
    const updatedUser = {
      ...user,
      passkeys: filtered,
      hasPasskey: filtered.length > 0,
    };
    const accounts = getAccountsDB();
    const updatedAccounts = accounts.map((acc) =>
      acc.id === user.id ? { ...acc, passkeys: filtered, hasPasskey: filtered.length > 0 } : acc
    );
    saveAccountsDB(updatedAccounts);
    saveCurrentUser(updatedUser);
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
