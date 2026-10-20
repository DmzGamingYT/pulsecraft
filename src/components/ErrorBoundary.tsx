import { Component, type ErrorInfo, type ReactNode } from 'react';
import { PulseMark } from './Icon';

interface State {
  error: Error | null;
}

/** Une erreur de rendu n'affiche jamais une page blanche. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Battement] Erreur de rendu', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="crash">
          <PulseMark size={46} />
          <p className="kicker">Erreur inattendue</p>
          <h1>Battement a rencontré un problème.</h1>
          <p>
            Vos données locales ne sont pas perdues. Rechargez la page ; si le problème persiste,
            ouvrez les outils de développement du navigateur pour voir le détail.
          </p>
          <pre>{this.state.error.message}</pre>
          <div className="crash__actions">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              Recharger
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => this.setState({ error: null })}
            >
              Réessayer
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
