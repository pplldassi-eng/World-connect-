import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorInfo: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, errorInfo: '' };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "Une erreur est survenue.";
      try {
        const parsed = JSON.parse(this.state.errorInfo);
        if (parsed.error && parsed.error.includes('permissions')) {
          displayMessage = "Vous n'avez pas la permission d'effectuer cette action ou de voir ces données.";
        }
      } catch (e) {
        // Pas un JSON valide, garder le message par défaut
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-center text-slate-100">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl max-w-md">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Mince !</h2>
            <p className="text-slate-400 mb-6 text-sm">{displayMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}
