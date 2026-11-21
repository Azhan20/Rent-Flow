import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { PublicWebsiteView } from './components/PublicWebsiteView';
import { WorkspaceSetup } from './components/WorkspaceSetup';
import { AuthModal } from './components/AuthModal';

const planNames: Record<string, string> = {
  'starter-depot': 'Starter Depot',
  'growth-fleet': 'Growth Fleet',
  'business-multi-yard': 'Business Multi-Yard',
};

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT' | 'PROFILE';

function PublicMarketingExperience({ initialAuthMode }: { initialAuthMode: AuthMode | null }) {
  const [authModalOpen, setAuthModalOpen] = useState(initialAuthMode !== null);
  const [authModalMode, setAuthModalMode] = useState<AuthMode>(initialAuthMode || 'LOGIN');

  const openAuth = (mode: AuthMode) => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <>
      <PublicWebsiteView
        onOpenAuthModal={openAuth}
        onOpenDashboard={() => openAuth('LOGIN')}
      />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </>
  );
}

function Application() {
  const { user, loading } = useAuth();
  const query = new URLSearchParams(window.location.search);
  const selectedPlan = planNames[query.get('plan') || ''];
  const initialAuthMode = query.get('auth') === 'signup'
    ? 'REGISTER'
    : query.get('auth') === 'reset'
      ? 'FORGOT'
      : query.has('auth')
        ? 'LOGIN'
        : null;
  const billingCycle = query.get('cycle') === 'yearly' ? 'yearly' : 'monthly';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-white">
        Loading secure session…
      </div>
    );
  }

  if (!user) {
    return <PublicMarketingExperience initialAuthMode={initialAuthMode} />;
  }

  if (!user.emailVerified) {
    return <AuthScreen selectedPlan={selectedPlan} />;
  }

  return <WorkspaceSetup selectedPlan={selectedPlan} billingCycle={billingCycle} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Application />
    </AuthProvider>
  );
}
