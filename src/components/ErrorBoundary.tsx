import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[HASPAHO ErrorBoundary] Uncaught rendering error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[280px] p-6 m-4 bg-slate-900 border-2 border-red-500/40 rounded-3xl text-white shadow-2xl flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 mb-4 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <span className="material-symbols-outlined text-[32px]">warning</span>
          </div>

          <h3 className="text-base sm:text-lg font-black text-white mb-1.5">
            {this.props.fallbackTitle || 'Instabilidade Recuperada'}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 max-w-md mb-4 leading-relaxed">
            Ocorreu uma inconsistência transitória ao carregar este elemento. O sistema conteve a falha para evitar a tela branca.
          </p>

          {this.state.error?.message && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-[11px] font-mono text-red-300 max-w-lg mb-5 break-all text-left">
              {this.state.error.message}
            </div>
          )}

          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <button
              type="button"
              onClick={this.handleReset}
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            >
              <span className="material-symbols-outlined text-[17px]">refresh</span>
              <span>Tentar Novamente</span>
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className="h-10 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700 shadow-xs"
            >
              <span className="material-symbols-outlined text-[17px]">restart_alt</span>
              <span>Recarregar Página</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
