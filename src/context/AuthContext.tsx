import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, firebaseConfigured, googleAuthProvider } from '../lib/firebase';
import { getAuthErrorMessage, getSafeAuthDiagnostic } from './auth-errors';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserDisplayName: (name: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const configuredAuth = auth;
    if (!configuredAuth) {
      setLoading(false);
      return;
    }
    let active = true;
    let unsubscribe = () => {};
    void setPersistence(configuredAuth, browserLocalPersistence)
      .catch(() => undefined)
      .then(() => {
        if (!active) return;
        unsubscribe = onAuthStateChanged(configuredAuth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
      });
    return () => { active = false; unsubscribe(); };
  }, []);

  const requireAuth = () => {
    if (!auth) throw new Error('Firebase Authentication is not configured.');
    return auth;
  };

  const runAuthAction = async (action: () => Promise<void>, logDiagnostic = false) => {
    setAuthError(null);
    try {
      await action();
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      if (logDiagnostic) {
        console.warn('[RentFlow Firebase Auth]', getSafeAuthDiagnostic(error));
      }
      // Keep the Firebase error object and its code intact for the caller.
      throw error;
    }
  };

  const value = useMemo<AuthContextType>(() => {
    const signInWithEmail = (email: string, pass: string) => runAuthAction(async () => {
      await signInWithEmailAndPassword(requireAuth(), email.trim(), pass);
    });
    const signUpWithEmail = (email: string, pass: string, displayName: string) => runAuthAction(async () => {
      const result = await createUserWithEmailAndPassword(requireAuth(), email.trim(), pass);
      if (displayName.trim()) await updateProfile(result.user, { displayName: displayName.trim() });
      await sendEmailVerification(result.user);
    });
    const signInWithGoogle = () => runAuthAction(async () => {
      await signInWithPopup(requireAuth(), googleAuthProvider);
    }, true);
    const sendPasswordReset = (email: string) => runAuthAction(async () => {
      await sendPasswordResetEmail(requireAuth(), email.trim());
    });
    const sendVerificationEmail = () => runAuthAction(async () => {
      const currentUser = requireAuth().currentUser;
      if (!currentUser) throw new Error('Sign in to resend the verification email.');
      await sendEmailVerification(currentUser);
    });
    const logout = () => runAuthAction(async () => {
      if (auth) await signOut(auth);
    });
    const updateUserDisplayName = (name: string) => runAuthAction(async () => {
      const currentUser = requireAuth().currentUser;
      if (!currentUser) throw new Error('Sign in to update your profile.');
      await updateProfile(currentUser, { displayName: name.trim() });
      setUser({ ...currentUser });
    });
    const getIdToken = async (forceRefresh = false) => {
      const currentUser = requireAuth().currentUser;
      if (!currentUser) throw new Error('Please sign in to continue.');
      return currentUser.getIdToken(forceRefresh);
    };

    return {
      user, loading, configured: firebaseConfigured, authError,
      clearAuthError: () => setAuthError(null),
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      sendPasswordReset,
      sendVerificationEmail,
      logout,
      updateUserDisplayName,
      signUp: (name, email, password) => signUpWithEmail(email, password, name),
      signIn: signInWithEmail,
      resetPassword: sendPasswordReset,
      resendVerification: sendVerificationEmail,
      signOutUser: logout,
      getIdToken,
    };
  }, [user, loading, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
