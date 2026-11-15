import { Component, type ReactNode } from 'react';
import { db } from '../db/db.ts';

/** Stops one broken screen from blanking the whole app, and offers a way out. Resets when the page address changes. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  reset = () => this.setState({ error: null });
  componentDidMount() { addEventListener('hashchange', this.reset); }
  componentWillUnmount() { removeEventListener('hashchange', this.reset); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ padding: 24, maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
        <h2>Something went wrong on this screen</h2>
        <p>Your saved data is safe. Details: <code>{this.state.error.message}</code></p>
        <p><button className="btn" onClick={this.reset}>Try again</button>{' '}
          <button className="btn ghost" onClick={async () => { await db.drafts.clear(); this.reset(); }}>Discard in-progress workout and retry</button>{' '}
          <button className="btn ghost" onClick={() => { location.hash = '/dashboard'; location.reload(); }}>Go to dashboard</button></p>
      </div>
    );
  }
}
