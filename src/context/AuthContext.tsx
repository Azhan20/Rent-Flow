import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  pendingPlan: string | null;
  setPendingPlan: (plan: string | null) => void;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserDisplayName: (name: string) => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatErrorMessage = (error: any): string => {
    const code = error?.code || '';
    switch (code) {
      case 'auth/invalid-email':
        return 'Please provide a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled by an administrator.';
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please check your credentials.';
      case 'auth/wrong-password':
        return 'Incorrect password. Try again or reset your password.';
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists. Please log in.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/popup-closed-by-user':
        return 'Google Sign-In popup was closed before completion.';
      case 'auth/too-many-requests':
        return 'Too many failed login attempts. Please wait a few moments before trying again.';
      default:
        return error?.message || 'Authentication failed. Please try again.';
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      const msg = formatErrorMessage(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, displayName: string) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (displayName && cred.user) {
        await updateProfile(cred.user, { displayName });
      }
      if (cred.user) {
        // Send email verification
        try {
          await sendEmailVerification(cred.user);
        } catch (vErr) {
          console.warn('Email verification send issue:', vErr);
        }
      }
    } catch (err: any) {
      const msg = formatErrorMessage(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      const msg = formatErrorMessage(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      const msg = formatErrorMessage(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err: any) {
      const msg = formatErrorMessage(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  const updateUserDisplayName = async (name: string) => {
    if (!auth.currentUser) return;
    await updateProfile(auth.currentUser, { displayName: name });
    setUser({ ...auth.currentUser });
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        pendingPlan,
        setPendingPlan,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        sendPasswordReset,
        sendVerificationEmail,
        logout,
        updateUserDisplayName,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
