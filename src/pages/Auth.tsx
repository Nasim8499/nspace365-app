import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import { Monogram, Wordmark } from '../components/Logo';
import { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } from '../lib/seed';

declare global {
  interface Window {
    google?: any;
  }
}

export default function Auth() {
  const { db, signIn, setSettings, toast, navigate } = useApp();
  const [mode, setMode] = useState<'applicant' | 'admin'>('applicant');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [showGoogleSetup, setShowGoogleSetup] = useState(false);
  const [clientId, setClientId] = useState(db.settings.googleClientId || '');
  const gbtn = useRef<HTMLDivElement>(null);

  const submit = () => {
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return setErr('Enter a valid email address.');
    if (password.length < 4) return setErr('Password needs at least 4 characters.');

    // the built-in agency administrator: always admin, works on any device
    const isDefaultAdmin = mail === ADMIN_EMAIL && password === ADMIN_PASSWORD;
    if (mail === ADMIN_EMAIL && !isDefaultAdmin) {
      return setErr('Wrong password for the agency admin account.');
    }
    if (!isDefaultAdmin && mode === 'admin' && code.trim().toUpperCase() !== (db.settings.adminCode || 'NSPACE-365')) {
      return setErr('Agency access code is wrong. Use the code from your agency admin.');
    }

    setErr('');
    const role: 'applicant' | 'admin' = isDefaultAdmin ? 'admin' : mode;
    const ok = signIn(name.trim() || (isDefaultAdmin ? ADMIN_NAME : mail.split('@')[0]), mail, role, password);
    if (!ok) return setErr('This email already has an account with a different password.');
    navigate('/dashboard');
    toast(isDefaultAdmin ? 'Signed in as agency admin' : role === 'admin' ? 'Signed in as agency admin' : 'Signed in as applicant');
  };

  // Real Google Identity Services sign-in when a client id is configured.
  useEffect(() => {
    const id = db.settings.googleClientId;
    if (!id) return;
    const init = () => {
      if (!window.google?.accounts?.id || !gbtn.current) return;
      window.google.accounts.id.initialize({
        client_id: id,
        callback: (res: { credential: string }) => {
          try {
            const payload = JSON.parse(atob(res.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            const known = db.users.find((u) => u.email.toLowerCase() === (payload.email || '').toLowerCase());
            const isAdmin = (payload.email || '').toLowerCase() === ADMIN_EMAIL || known?.role === 'admin';
            signIn(payload.name || payload.email, payload.email, isAdmin ? 'admin' : 'applicant');
            navigate('/dashboard');
            toast(isAdmin ? 'Signed in with Google as agency admin' : 'Signed in with Google');
          } catch {
            setErr('Google returned a token we could not read.');
          }
        },
      });
      window.google.accounts.id.renderButton(gbtn.current, { theme: 'outline', size: 'large', width: 300 });
    };
    if (window.google?.accounts?.id) init();
    else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = init;
      document.head.appendChild(s);
    }
  }, [db.settings.googleClientId]);

  return (
    <div className="authwrap">
      <div className="glass authcard">
        <Monogram size={68} />
        <Wordmark size={28} />
        <p className="sub" style={{ margin: 0 }}>
          Visa cases, documents and agent progress — applicants see their own file, the agency sees everything.
        </p>

        <div className="authtabs">
          <button className={`authtab${mode === 'applicant' ? ' on' : ''}`} onClick={() => setMode('applicant')}>
            <Icon name="user" size={14} /> Applicant
          </button>
          <button className={`authtab${mode === 'admin' ? ' on' : ''}`} onClick={() => setMode('admin')}>
            <Icon name="shield" size={14} /> Agency admin
          </button>
        </div>

        <div style={{ width: '100%' }}>
          <input
            className="input"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginBottom: 8 }}
            data-testid="auth-name"
          />
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: 8 }}
            data-testid="auth-email"
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={{ marginBottom: mode === 'admin' ? 8 : 12 }}
            data-testid="auth-password"
          />
          {mode === 'admin' && (
            <input
              className="input"
              placeholder="Agency access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              style={{ marginBottom: 12 }}
              data-testid="auth-code"
            />
          )}
          {err && <div className="autherr">{err}</div>}
          <button className="btn dark block" onClick={submit} style={{ height: 44 }} data-testid="auth-submit">
            <Icon name="arrowRight" size={16} /> Continue as {mode === 'admin' ? 'agency admin' : 'applicant'}
          </button>

          <button
            className="authquick"
            onClick={() => {
              setMode('admin');
              setEmail(ADMIN_EMAIL);
              setName((n) => n || ADMIN_NAME);
              setCode(db.settings.adminCode || 'NSPACE-365');
              setErr('');
            }}
            data-testid="auth-fill-admin"
          >
            <Icon name="shield" size={13} /> Use the agency admin account
          </button>

          <div className="authdivider"><span>or</span></div>

          {db.settings.googleClientId ? (
            <div ref={gbtn} style={{ display: 'flex', justifyContent: 'center' }} />
          ) : (
            <button className="btn block" style={{ height: 44 }} onClick={() => setShowGoogleSetup(true)}>
              <Icon name="globe" size={16} /> Continue with Google
            </button>
          )}

          {showGoogleSetup && (
            <div className="googlesetup">
              <div className="hint" style={{ lineHeight: 1.5 }}>
                Google sign-in needs an OAuth client ID (Google Cloud → Credentials → OAuth client → Web). Paste it
                once and the real Google button appears here for everyone who opens the app.
              </div>
              <input
                className="input"
                placeholder="1234-abc.apps.googleusercontent.com"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                style={{ marginTop: 8 }}
                data-testid="google-client-id"
              />
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <button
                  className="btn sm primary"
                  onClick={() => {
                    setSettings({ googleClientId: clientId.trim() });
                    setShowGoogleSetup(false);
                    toast('Google client ID saved — the Google button is live');
                  }}
                >
                  Save client ID
                </button>
                <button className="btn sm ghost" onClick={() => setShowGoogleSetup(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="row" style={{ marginTop: 10, gap: 8 }}>
          <span style={{ color: 'var(--muted-2)' }}>
            <Icon name="shield" size={14} />
          </span>
          <span className="hint">
            {mode === 'admin'
              ? `Admin: ${ADMIN_EMAIL} signs in with the agency password. Agency code for other admins: ${db.settings.adminCode || 'NSPACE-365'}.`
              : 'Applicant accounts only see their own cases and uploads.'}
          </span>
        </div>
      </div>
    </div>
  );
}
