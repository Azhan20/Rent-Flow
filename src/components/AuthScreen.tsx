import React, { useState } from 'react';
import { Building2, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAuthErrorMessage } from '../context/auth-errors';
import { usePageMetadata } from '../lib/pageMetadata';

type Mode = 'login' | 'signup' | 'reset';

export const AuthScreen: React.FC<{ selectedPlan?: string; initialMode?: Mode }> = ({ selectedPlan, initialMode = 'login' }) => {
  usePageMetadata('Sign in | RentFlow', false);
  const { configured, user, signUp, signIn, signInWithGoogle, resetPassword, resendVerification, refreshEmailVerificationStatus, signOutUser } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); }
    catch (caught) { setError(getAuthErrorMessage(caught, mode === 'reset')); }
    finally { setBusy(false); }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (mode === 'signup') {
        await signUp(name, email, password);
        setNotice('Account created. Check your inbox for an email verification link.');
      } else if (mode === 'reset') {
        await resetPassword(email);
        setNotice('If an account matches that address, a password reset email will arrive shortly.');
      } else await signIn(email, password);
    });
  };

  if (user && !user.emailVerified) return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl sm:p-8" aria-labelledby="verify-title">
        <ShieldCheck className="mb-4 h-9 w-9 text-blue-600" />
        <h1 id="verify-title" className="text-2xl font-bold text-slate-900">Verify your email</h1>
        <p className="mt-2 break-words text-sm text-slate-600">We sent a verification link to {user.email}. After verifying, return to this tab; RentFlow will refresh your session and open your workspace automatically. If the link expired or was already used, request a fresh one.</p>
        {notice && <p role="status" className="mt-4 text-sm text-emerald-700">{notice}</p>}
        {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void run(async () => { await resendVerification(); setNotice('A fresh verification email has been sent.'); })}>Resend verification email</button>
          <button type="button" className="rounded-lg border px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50" disabled={busy} onClick={() => void run(async () => {
            const verified = await refreshEmailVerificationStatus();
            if (!verified) setNotice('RentFlow has not received the verification yet. Open the latest email link, then return here.');
          })}>I’ve verified my email</button>
          <button type="button" className="rounded-lg border px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50" disabled={busy} onClick={() => void signOutUser()}>Sign out</button>
        </div>
      </section>
    </main>
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <section className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl sm:p-9" aria-labelledby="auth-title">
        <div className="mb-7 flex items-center gap-3"><span className="rounded-xl bg-blue-600 p-2.5 text-white"><Building2 className="h-6 w-6" /></span><span className="text-xl font-bold text-slate-900">RentFlow</span></div>
        <h1 id="auth-title" className="text-2xl font-bold text-slate-900">{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Sign in to RentFlow'}</h1>
        <p className="mt-2 text-sm text-slate-600">{selectedPlan ? `Selected plan: ${selectedPlan}. Payment setup is not available yet; choosing it does not activate a subscription.` : 'Secure access for your rental business.'}</p>
        {!configured && <p role="status" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Firebase Authentication is not configured. Add the public Firebase web settings to your local environment to enable sign in.</p>}
        {mode !== 'reset' && configured && <button type="button" disabled={busy} onClick={() => void run(signInWithGoogle)} className="mt-6 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Continue with Google</button>}
        {mode !== 'reset' && configured && <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or with email<span className="h-px flex-1 bg-slate-200" /></div>}
        <form className="space-y-4" onSubmit={submit}>
          {mode === 'signup' && <label className="block text-sm font-medium text-slate-700">Name<input autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>}
          <label className="block text-sm font-medium text-slate-700">Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          {mode !== 'reset' && <label className="block text-sm font-medium text-slate-700">Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
          <button type="submit" disabled={busy || !configured} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Sign in'}</button>
        </form>
        <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm">
          {mode === 'login' && <button className="min-h-11 text-blue-700 hover:underline" onClick={() => setMode('reset')}>Forgot password?</button>}
          <button className="ml-auto min-h-11 text-blue-700 hover:underline" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setNotice(''); }}>{mode === 'signup' ? 'Already registered? Sign in' : 'Create an account'}</button>
        </div>
      </section>
    </main>
  );
};
