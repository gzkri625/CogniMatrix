import { Component, type ReactNode } from 'react';

/** Shows what broke instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center-page">
        <div className="big-emoji">⚠️</div>
        <h1>Bir şeyler ters gitti</h1>
        <p className="muted">
          <code>{this.state.error.message}</code>
        </p>
        <button className="btn" onClick={() => this.setState({ error: null })}>Tekrar dene</button>
      </div>
    );
  }
}
