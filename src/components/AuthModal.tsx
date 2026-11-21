import React, { useEffect, useRef, useState } from 'react';
import { 
  Lock, 
  Mail, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  HardHat, 
  LogOut,
  Send,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'LOGIN' | 'REGISTER' | 'FORGOT' | 'PROFILE';
  onAuthSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'LOGIN',
  onAuthSuccess,
}) => {
  const { 
    user, 
    configured,
    signInWithEmail, 
    signUpWithEmail, 
    signInWithGoogle, 
    sendPasswordReset, 
    sendVerificationEmail,
    logout, 
    authError, 
    clearAuthError,
  } = useAuth();

  const modalRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT' | 'PROFILE'>(
    user ? 'PROFILE' : initialMode
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setMode(user ? 'PROFILE' : initialMode);
  }, [isOpen, initialMode, user]);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusableElements = () => modalRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );
    getFocusableElements()?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements();
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modalRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !modalRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setSuccessMessage(null);

    if (mode === 'REGISTER' && password !== confirmPassword) {
      alert('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'LOGIN') {
        await signInWithEmail(email, password);
        setSuccessMessage('Logged in successfully!');
        setTimeout(() => {
          onClose();
          if (onAuthSuccess) onAuthSuccess();
        }, 600);
      } else if (mode === 'REGISTER') {
        await signUpWithEmail(email, password, displayName);
        setSuccessMessage('Account created! A verification link has been sent to your email.');
        setTimeout(() => {
          onClose();
          if (onAuthSuccess) onAuthSuccess();
        }, 1200);
      } else if (mode === 'FORGOT') {
        await sendPasswordReset(email);
        setSuccessMessage('Password reset instructions sent to your email.');
      }
    } catch {
      // AuthContext stores a safe message for the modal.
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearAuthError();
    setSuccessMessage(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      setSuccessMessage('Google Sign-In successful!');
      setTimeout(() => {
        onClose();
        if (onAuthSuccess) onAuthSuccess();
      }, 600);
    } catch {
      // AuthContext stores the user message and logs only sanitized diagnostics.
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      setSuccessMessage('Logged out successfully.');
      setMode('LOGIN');
    } catch {
      // AuthContext stores a safe message for the modal.
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      await sendVerificationEmail();
      setSuccessMessage('Fresh verification email sent.');
    } catch {
      // AuthContext stores a safe message for the modal.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/96 p-4 backdrop-blur-2xl">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        tabIndex={-1}
        className="relative my-4 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-slate-100 shadow-xl animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl sm:my-8 sm:p-6"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:right-4 sm:top-4"
          aria-label="Close authentication modal"
        >
          ✕
        </button>

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <HardHat className="h-5 w-5" />
          </div>
          <div>
            <h3 id="auth-modal-title" className="text-lg font-bold text-slate-100 flex items-center gap-2">
              RentFlow Account
            </h3>
            <p className="text-xs text-slate-400">
              Secure Firebase Authentication
            </p>
          </div>
        </div>

        {!configured && (
          <div role="status" className="mb-4 rounded-xl border border-amber-700 bg-amber-950/50 p-3 text-xs text-amber-200">
            Firebase Authentication is not configured. Add the public Firebase web settings to enable sign in.
          </div>
        )}

        {/* Error notification banner */}
        {authError && (
          <div className="mb-4 rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
            <span className="flex-1">{authError}</span>
          </div>
        )}

        {/* Success message banner */}
        {successMessage && (
          <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="flex-1">{successMessage}</span>
          </div>
        )}

        {/* Mode Selector Tabs (if not signed in) */}
        {!user && (
          <div className="flex rounded-xl bg-slate-800 p-1 mb-5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setMode('LOGIN'); clearAuthError(); setSuccessMessage(null); }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'LOGIN'
                  ? 'bg-slate-700 text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('REGISTER'); clearAuthError(); setSuccessMessage(null); }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'REGISTER'
                  ? 'bg-slate-700 text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => { setMode('FORGOT'); clearAuthError(); setSuccessMessage(null); }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'FORGOT'
                  ? 'bg-slate-700 text-white shadow-xs font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Reset
            </button>
          </div>
        )}

        {/* USER PROFILE VIEW (when authenticated) */}
        {user ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Authenticated Email</span>
                <span className="font-mono font-bold text-slate-200">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Display Name</span>
                <span className="font-semibold text-slate-200">{user.displayName || 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Email Verification</span>
                <span className={`font-semibold flex items-center gap-1 ${user.emailVerified ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {user.emailVerified ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                    </>
                  ) : (
                    'Pending'
                  )}
                </span>
              </div>
            </div>

            {!user.emailVerified && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={loading}
                className="w-full py-2 rounded-xl border border-amber-700 bg-amber-950/40 text-amber-200 font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-950/70"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Resend Verification Email</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-rose-300 font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of RentFlow</span>
            </button>
          </div>
        ) : (
          /* LOGIN / REGISTER / FORGOT FORM */
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {mode === 'REGISTER' && (
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Full Name / Organization Lead *
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Marcus Vance"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Work Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {mode !== 'FORGOT' && (
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-10 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-100"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'REGISTER' && (
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Action Submit Button */}
            <button
              type="submit"
              disabled={loading || !configured}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'LOGIN' ? 'Sign In to Workspace' : mode === 'REGISTER' ? 'Create Free Account' : 'Send Reset Link'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-semibold text-slate-400">
                <span className="bg-slate-900 px-2">Or continue with</span>
              </div>
            </div>

            {/* Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || !configured}
              className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold flex items-center justify-center gap-2.5 transition-all shadow-2xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
