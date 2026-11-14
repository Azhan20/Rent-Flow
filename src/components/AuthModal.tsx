import React, { useState } from 'react';
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
  ShieldCheck, 
  LogOut,
  Send,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRentFlow } from '../context/RentFlowContext';

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
    signInWithEmail, 
    signUpWithEmail, 
    signInWithGoogle, 
    sendPasswordReset, 
    sendVerificationEmail,
    logout, 
    authError, 
    clearAuthError,
    pendingPlan,
    setPendingPlan,
  } = useAuth();

  const { currentOrg } = useRentFlow();

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
    } catch (err) {
      console.error('Auth error:', err);
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
    } catch (err) {
      console.error('Google auth error:', err);
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
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      await sendVerificationEmail();
      setSuccessMessage('Fresh verification email sent.');
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
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
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              RentFlow Account
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {pendingPlan ? `Sign in to activate ${pendingPlan} Plan` : 'Secure Firebase Authentication'}
            </p>
          </div>
        </div>

        {/* Pending Plan Notice */}
        {pendingPlan && (
          <div className="mb-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Plan Selection Saved: <strong>{pendingPlan}</strong>. Complete sign-in to proceed to checkout.
            </span>
          </div>
        )}

        {/* Error notification banner */}
        {authError && (
          <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="flex-1">{authError}</span>
          </div>
        )}

        {/* Success message banner */}
        {successMessage && (
          <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="flex-1">{successMessage}</span>
          </div>
        )}

        {/* Mode Selector Tabs (if not signed in) */}
        {!user && (
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setMode('LOGIN'); clearAuthError(); setSuccessMessage(null); }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'LOGIN'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('REGISTER'); clearAuthError(); setSuccessMessage(null); }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'REGISTER'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => { setMode('FORGOT'); clearAuthError(); setSuccessMessage(null); }}
              className={`flex-1 py-1.5 rounded-lg transition-all ${
                mode === 'FORGOT'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Reset
            </button>
          </div>
        )}

        {/* USER PROFILE VIEW (when authenticated) */}
        {user ? (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Authenticated Email</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Display Name</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{user.displayName || 'Operations Lead'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Active Tenant</span>
                <span className="font-bold text-blue-600">{currentOrg.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Subscription Tier</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-bold text-[10px]">
                  {currentOrg.planTier} PLAN
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email Verification</span>
                <span className={`font-semibold flex items-center gap-1 ${user.emailVerified ? 'text-emerald-600' : 'text-amber-600'}`}>
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
                className="w-full py-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-100"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Resend Verification Email</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 font-bold flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-all"
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
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {mode !== 'FORGOT' && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-10 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'REGISTER' && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Action Submit Button */}
            <button
              type="submit"
              disabled={loading}
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
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-semibold text-slate-400">
                <span className="bg-white dark:bg-slate-900 px-2">Or continue with</span>
              </div>
            </div>

            {/* Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold flex items-center justify-center gap-2.5 transition-all shadow-2xs"
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
