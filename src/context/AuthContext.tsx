import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  reload,
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
import { consumeEmailVerificationReturn, createEmailVerificationContinueUrl } from './auth-navigation';

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
  refreshEmailVerificationStatus: () => Promise<boolean>;
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
  const verificationRefreshPending = useRef(false);
  const verificationCheckPromise = useRef<Promise<boolean> | null>(null);

  const refreshEmailVerificationStatus = useCallback(async () => {
    if (verificationCheckPromise.current) return verificationCheckPromise.current;
    const configuredAuth = auth;
    const currentUser = configuredAuth?.currentUser;
    if (!configuredAuth || !currentUser) return false;

    verificationRefreshPending.current = true;
    const check = (async () => {
      await reload(currentUser);
      if (configuredAuth.currentUser?.uid !== currentUser.uid) {
        verificationRefreshPending.current = false;
        return false;
      }

      if (currentUser.emailVerified) {
        // Refresh the token so backend email_verified claims match the refreshed profile.
        await currentUser.getIdToken(true);
      }

      if (configuredAuth.currentUser?.uid === currentUser.uid) setUser({ ...currentUser });
      verificationRefreshPending.current = false;
      return currentUser.emailVerified;
    })();
    verificationCheckPromise.current = check;
    try {
      return await check;
    } finally {
      if (verificationCheckPromise.current === check) verificationCheckPromise.current = null;
    }
  }, []);

  useEffect(() => {
    const configuredAuth = auth;
    if (!configuredAuth) {
      setLoading(false);
      return;
    }
    let active = true;
    let unsubscribe = () => {};
    let refreshInFlight = false;
    const verificationReturn = consumeEmailVerificationReturn(window.location.href);
    let verificationReturnPending = verificationReturn.returnedFromVerification;
    if (verificationReturn.returnedFromVerification) {
      window.history.replaceState(window.history.state, '', verificationReturn.relativeUrl);
    }

    const refreshOnReturn = (force = false) => {
      if (document.visibilityState === 'hidden' || refreshInFlight) return false;
      const currentUser = configuredAuth.currentUser;
      if (!currentUser || (!force && currentUser.emailVerified && !verificationRefreshPending.current)) return false;
      refreshInFlight = true;
      void refreshEmailVerificationStatus()
        .catch(() => undefined)
        .finally(() => {
          if (active) {
            const latestUser = configuredAuth.currentUser;
            if (latestUser) {
              setUser(verificationRefreshPending.current
                ? { ...latestUser, emailVerified: false }
                : { ...latestUser });
            } else {
              setUser(null);
            }
            setLoading(false);
          }
          refreshInFlight = false;
        });
      return true;
    };

    const publishAuthUser = (currentUser: User | null) => {
      if (!active) return;
      if (!currentUser) verificationRefreshPending.current = false;
      setUser(currentUser ? { ...currentUser } : null);
      setLoading(false);
    };

    const checkForVerificationReturn = () => {
      if (refreshOnReturn(verificationReturnPending)) verificationReturnPending = false;
    };

    const handleAuthUser = (currentUser: User | null) => {
      if (!currentUser) {
        publishAuthUser(null);
        return;
      }
      if (verificationReturnPending) {
        // Keep the app in its secure loading state until the profile and token are refreshed.
        if (refreshOnReturn(true)) verificationReturnPending = false;
        return;
      }
      publishAuthUser(currentUser);
    };

    void setPersistence(configuredAuth, browserLocalPersistence)
      .catch(() => undefined)
      .then(() => {
        if (!active) return;
        unsubscribe = onIdTokenChanged(configuredAuth, handleAuthUser);
        document.addEventListener('visibilitychange', checkForVerificationReturn);
        window.addEventListener('focus', checkForVerificationReturn);
        window.addEventListener('pageshow', checkForVerificationReturn);
      });
    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', checkForVerificationReturn);
      window.removeEventListener('focus', checkForVerificationReturn);
      window.removeEventListener('pageshow', checkForVerificationReturn);
    };
  }, [refreshEmailVerificationStatus]);

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
      await sendEmailVerification(result.user, {
        url: createEmailVerificationContinueUrl(window.location.href),
      });
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
      await reload(currentUser);
      if (currentUser.emailVerified) {
        await currentUser.getIdToken(true);
        setUser({ ...currentUser });
        return;
      }
      await sendEmailVerification(currentUser, {
        url: createEmailVerificationContinueUrl(window.location.href),
      });
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
      refreshEmailVerificationStatus,
      logout,
      updateUserDisplayName,
      signUp: (name, email, password) => signUpWithEmail(email, password, name),
      signIn: signInWithEmail,
      resetPassword: sendPasswordReset,
      resendVerification: sendVerificationEmail,
      signOutUser: logout,
      getIdToken,
    };
  }, [user, loading, authError, refreshEmailVerificationStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
