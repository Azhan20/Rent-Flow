import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { safeRuntimeErrorType } from '../lib/safe-runtime-error';

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { failed: boolean };

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, _errorInfo: ErrorInfo) {
    console.error(JSON.stringify({ area: 'frontend.render', errorType: safeRuntimeErrorType(error) }));
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-900">
        <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl sm:p-8" role="alert" aria-labelledby="app-error-title">
          <h1 id="app-error-title" className="text-xl font-bold">RentFlow couldn’t load this page</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">A page error was recorded without including account or request details. Reload to try again.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Reload page</button>
        </section>
      </main>
    );
  }
}
