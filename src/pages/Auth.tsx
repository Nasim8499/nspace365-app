import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import { Monogram, Wordmark } from '../components/Logo';
import { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } from '../lib/seed';
import { fbError, fbGoogle, fbSignIn, fbSignUp } from '../lib/fbauth';
import { firebaseConfigured } from '../lib/firebase';

declare global {
  interface Window {
    google?: any;
  }
}

type Stage = 'form' | 'sent' | 'verified' | 'badlink';

function readVerifyHash() {
  const h = location.hash || '';
  const at = h.indexOf('?');
  if (!h.startsWith('#/verify') || at < 0) return null;
  const q = new URLSearchParams(h.slice(at + 1));
  const email = q.get('e') || '';
  const token = q.get('t') || '';
  if (!email) return null;
  return { email, token };
}

export default function Auth() {
  const { db, signIn, registerUser, verifyEmail, resendVerification, setSettings, toast, navigate } = useApp();
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [mode, setMode] = useState<'applicant' | 'admin'>('applicant');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [showGoogleSetup, setShowGoogleSetup] = useState(false);
  const [clientId, setClientId] = useState(db.settings.googleClientId || '');
  const [stage, setStage] = useState<Stage>(() => (readVerifyHash() ? 'badlink' : 'form'));
  const [sentTo, setSentTo] = useState('');
  const [sentToken, setSentToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [fbMail, setFbMail] = useState(false);
  const fbOn = firebaseConfigured();
  const gbtn = useRef<HTMLDivElement>(null);

  // the verification link comes back as #/verify?e=email&t=token (works on load and on later hash changes)
  const runVerify = React.useCallback(() => {
    const found = readVerifyHash();
    if (!found) return;
    const result = verifyEmail(found.email, found.token);
    if (result === 'ok') {
      setStage('verified');
      setSentTo(found.email);
      toast('Email verified — welcome in');
      window.setTimeout(() => navigate('/dashboard'), 1500);
      return;
    }
    setStage('badlink');
    setEmail(found.email);
    setErr(
      result === 'used'
        ? 'That link has already been used. Sign in with your password instead.'
        : result === 'unknown'
        ? 'We could not find an account for that address on this device. Sign up again to get a fresh link.'
        : 'That verification link is not valid any more.'
    );
  }, [navigate, toast, verifyEmail]);

  useEffect(() => {
    runVerify();
    window.addEventListener('hashchange', runVerify);
    return () => window.removeEventListener('hashchange', runVerify);
  }, [runVerify]);

  const openMailbox = (mail: string, token: string) => {
    setSentTo(mail);
    setSentToken(token);
    setStage('sent');
  };

  const submit = async () => {
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

    // Firebase Authentication is the source of truth whenever it is configured
    if (fbOn) {
      setBusy(true);
      try {
        if (tab === 'signup') {
          if (!name.trim()) return setErr('Add your name so we know who this account belongs to.');
          const acc = await fbSignUp(name.trim(), mail, password);
          signIn(acc.name, acc.email, mode);
          setFbMail(true);
          setSentTo(acc.email);
          setSentToken('');
          setStage('sent');
          toast('Account created — check your inbox to verify');
          return;
        }
        const acc = await fbSignIn(mail, password);
        signIn(acc.name, acc.email, isDefaultAdmin ? 'admin' : acc.role);
        if (!acc.verified) toast('Signed in — verify your email from your inbox');
        navigate('/dashboard');
        toast(isDefaultAdmin || acc.role === 'admin' ? 'Signed in as agency admin' : 'Signed in as applicant');
        return;
      } catch (e) {
        setErr(fbError(e));
        return;
      } finally {
        setBusy(false);
      }
    }

    if (tab === 'signup') {
      if (!name.trim()) return setErr('Add your name so we know who this account belongs to.');
      const res = registerUser(name.trim(), mail, mode, password);
      if (res.status === 'exists') return setErr('This email already has an account. Sign in instead.');
      toast('Verification link ready');
      return openMailbox(mail, res.token);
    }

    const known = db.users.find((u) => u.email.toLowerCase() === mail);
    if (known && known.verified === false) {
      const token = resendVerification(mail);
      toast('Verify your email to finish signing in');
      return openMailbox(mail, token);
    }

    const role: 'applicant' | 'admin' = isDefaultAdmin ? 'admin' : mode;
    const ok = signIn(name.trim() || (isDefaultAdmin ? ADMIN_NAME : mail.split('@')[0]), mail, role, password);
    if (!ok) return setErr('This email already has an account with a different password.');
    navigate('/dashboard');
    toast(isDefaultAdmin ? 'Signed in as agency admin' : role === 'admin' ? 'Signed in as agency admin' : 'Signed in as applicant');
  };

  const resend = () => {
    const token = resendVerification(sentTo);
    if (!token) return setErr('That account no longer exists on this device.');
    setSentToken(token);
    toast('New verification link ready');
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

  const link = `#/verify?e=${encodeURIComponent(sentTo)}&t=${encodeURIComponent(sentToken)}`;

  if (stage === 'verified') {
    return (
      <div className="authwrap">
        <div className="aurora" aria-hidden="true" />
        <div className="glass authcard popin">
          <div className="verifyring">
            <Icon name="check" size={30} />
          </div>
          <h2 className="authtitle">Email verified</h2>
          <p className="sub" style={{ margin: 0 }}>
            {sentTo} is confirmed. Opening your workspace now.
          </p>
          <div className="loadbar">
            <span />
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'sent' && fbMail) {
    return (
      <div className="authwrap">
        <div className="aurora" aria-hidden="true" />
        <div className="glass authcard popin">
          <Monogram size={56} />
          <h2 className="authtitle">Verify your email</h2>
          <p className="sub" style={{ margin: 0 }}>
            Firebase sent a verification link to <b>{sentTo}</b>. Open it, then come back and sign in. Your account
            already exists, so nothing is lost if you close this screen.
          </p>
          <button
            className="btn dark block"
            style={{ height: 44, marginTop: 12 }}
            onClick={() => {
              setStage('form');
              setTab('signin');
              setErr('');
            }}
          >
            <Icon name="arrowRight" size={16} /> Back to sign in
          </button>
          <div className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
            Signed in with Firebase Authentication · {sentTo}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'sent') {
    return (
      <div className="authwrap">
        <div className="aurora" aria-hidden="true" />
        <div className="glass authcard popin">
          <Monogram size={56} />
          <h2 className="authtitle">Check your inbox</h2>
          <p className="sub" style={{ margin: 0 }}>
            We sent a verification link to <b>{sentTo}</b>. Open it and your session starts automatically.
          </p>

          <div className="mailcard">
            <div className="mailtop">
              <div className="mailavatar">
                <Icon name="doc" size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>NsPaces Studio</b>
                <div className="mailmeta">security@nspaces.studio · just now</div>
              </div>
              <span className="mailpill">Verify</span>
            </div>
            <div className="mailsubject">Verify your email address</div>
            <p className="mailbody">
              Tap the button below to confirm {sentTo} and open your NsPaces Studio workspace. The link works once and
              expires after 24 hours.
            </p>
            <a className="btn dark block" href={link} data-testid="verify-open">
              <Icon name="check" size={16} /> Verify my email
            </a>
          </div>

          <div className="row" style={{ gap: 8, width: '100%', marginTop: 12 }}>
            <button className="btn sm ghost" onClick={resend} data-testid="auth-resend">
              <Icon name="refresh" size={13} /> Resend link
            </button>
            <button
              className="btn sm ghost"
              onClick={() => {
                setStage('form');
                setErr('');
              }}
            >
              Change email
            </button>
          </div>
          <div className="hint" style={{ textAlign: 'center' }}>
            Mail preview shown here because no SMTP key is connected yet. Connect one and the same link is delivered to
            the real inbox.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="authwrap">
      <div className="aurora" aria-hidden="true" />
      <div className="glass authcard">
        <Monogram size={68} />
        <Wordmark size={28} />
        <p className="sub" style={{ margin: 0 }}>
          Visa cases, documents and agent progress — applicants see their own file, the agency sees everything.
        </p>

        <div className="segctl" role="tablist" aria-label="Account">
          <button
            role="tab"
            aria-selected={tab === 'signin'}
            className={`seg${tab === 'signin' ? ' on' : ''}`}
            onClick={() => {
              setTab('signin');
              setErr('');
            }}
            data-testid="auth-tab-signin"
          >
            Sign in
          </button>
          <button
            role="tab"
            aria-selected={tab === 'signup'}
            className={`seg${tab === 'signup' ? ' on' : ''}`}
            onClick={() => {
              setTab('signup');
              setName('');
              setErr('');
            }}
            data-testid="auth-tab-signup"
          >
            Create account
          </button>
        </div>

        <div className="authtabs">
          <button className={`authtab${mode === 'applicant' ? ' on' : ''}`} onClick={() => setMode('applicant')}>
            <Icon name="user" size={14} /> Applicant
          </button>
          <button className={`authtab${mode === 'admin' ? ' on' : ''}`} onClick={() => setMode('admin')}>
            <Icon name="shield" size={14} /> Agency admin
          </button>
        </div>

        <div style={{ width: '100%' }}>
          {(tab === 'signup' || true) && (
            <input
              className="input"
              placeholder={tab === 'signup' ? 'Full name' : 'Full name (optional)'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ marginBottom: 8 }}
              data-testid="auth-name"
            />
          )}
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
          <button
            className="btn dark block"
            onClick={() => void submit()}
            disabled={busy}
            style={{ height: 44 }}
            data-testid="auth-submit"
          >
            <Icon name="arrowRight" size={16} />
            {busy
              ? 'Working…'
              : tab === 'signup'
              ? 'Create account'
              : `Continue as ${mode === 'admin' ? 'agency admin' : 'applicant'}`}
          </button>

          <button
            className="authquick"
            onClick={() => {
              setTab('signin');
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

          {fbOn ? (
            <button
              className="btn block"
              style={{ height: 44 }}
              onClick={async () => {
                setErr('');
                setBusy(true);
                try {
                  const acc = await fbGoogle();
                  signIn(acc.name, acc.email, acc.role);
                  navigate('/dashboard');
                  toast(acc.role === 'admin' ? 'Signed in with Google as agency admin' : 'Signed in with Google');
                } catch (e) {
                  if ((e as Error).message !== 'redirecting') setErr(fbError(e));
                } finally {
                  setBusy(false);
                }
              }}
              data-testid="auth-google"
            >
              <Icon name="globe" size={16} /> Continue with Google
            </button>
          ) : db.settings.googleClientId ? (
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
