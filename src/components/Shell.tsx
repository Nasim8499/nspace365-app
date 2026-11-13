import React from 'react';
import { useApp } from '../lib/store';
import Icon from './Icon';
import { Monogram } from './Logo';

const NAV = [
  { to: '/dashboard', icon: 'grid', label: 'Dashboard' },
  { to: '/chat', icon: 'chat', label: 'Chat' },
  { to: '/visa', icon: 'passport', label: 'Visa Automate' },
  { to: '/agents', icon: 'bot', label: 'Agents' },
  { to: '/automations', icon: 'bolt', label: 'Automations' },
  { to: '/artifacts', icon: 'layers', label: 'Artifacts' },
  { to: '/memory', icon: 'brain', label: 'Memory', mobile: false },
  { to: '/me', icon: 'user', label: 'Me' },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { db, route, navigate, toasts, setSettings } = useApp();
  const active = (to: string) => route === to || route.startsWith(to + '/');
  const dark = db.settings.theme === 'dark';

  return (
    <div className="app">
      <nav className="rail" aria-label="Primary">
        <div className="rail-top">
          <button
            className="navbtn"
            style={{ padding: 0 }}
            onClick={() => navigate('/chat')}
            aria-label="NsPace home"
          >
            <Monogram size={38} />
          </button>
        </div>

        {NAV.map((n) => (
          <button
            key={n.to}
            className={`navbtn${active(n.to) ? ' on' : ''}${n.mobile === false ? ' desktop-only' : ''}`}
            onClick={() => navigate(n.to)}
            aria-label={n.label}
          >
            <Icon name={n.icon} size={20} />
            <span className="lbl">{n.label}</span>
            <span className="tip">{n.label}</span>
          </button>
        ))}

        <div className="rail-spacer" />

        <button
          className="navbtn desktop-only"
          onClick={() => setSettings({ theme: dark ? 'light' : 'dark' })}
          aria-label="Toggle theme"
        >
          <Icon name={dark ? 'sun' : 'moon'} size={20} />
          <span className="tip">{dark ? 'Light' : 'Dark'}</span>
        </button>
        <button
          className={`navbtn desktop-only${active('/download') ? ' on' : ''}`}
          onClick={() => navigate('/download')}
          aria-label="Download"
        >
          <Icon name="download" size={20} />
          <span className="tip">Get the app</span>
        </button>
        <button
          className="navbtn desktop-only"
          onClick={() => navigate('/me')}
          aria-label="Account"
          style={{ marginTop: 2 }}
        >
          <span
            className="avatar"
            style={{ background: 'linear-gradient(135deg,#34C759,#0A84FF)' }}
          >
            {(db.settings.name || 'You')
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join('')
              .toUpperCase() || 'Y'}
          </span>
          <span className="tip">Account</span>
        </button>
      </nav>

      <div className="page-anim" key={route}>
        {children}
      </div>

      <div className="toasts">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
