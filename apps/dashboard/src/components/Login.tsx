import { useState } from 'react';
import { useLensStore } from '../store';

export function Login() {
  const login = useLensStore(state => state.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simple hardcoded auth for now
    if (username === 'admin' && password === 'admin') {
      login({ username, role: 'admin' });
    } else {
      setError('Invalid credentials');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img
            src="/assets/logo_dark_full.svg"
            alt="Rayforce DB"
            className="login-logo"
            style={{ height: 64 }}
          />
          <p className="login-subtitle">Reactive Analytics Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="login-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 4h2v5H7V4zm0 6h2v2H7v-2z"/>
              </svg>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading || !username || !password}
          >
            {isLoading ? (
              <span className="login-spinner" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-hint">
            Default credentials: <code>admin</code> / <code>admin</code>
          </p>
        </div>
      </div>

      <div className="login-background">
        <div className="login-grid" />
      </div>
    </div>
  );
}
