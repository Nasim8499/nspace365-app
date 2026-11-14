import React from 'react';
import { useApp } from '../lib/store';
import Icon from './Icon';
import { Monogram } from './Logo';

const RAIL = [
  { to: '/chat', icon: 'chat', label: 'Chats' },
  { to: '/agents', icon: 'bot', label: 'Agents' },
  { to: '/automations', icon: 'sliders', label: 'Automations' },
  { to: '/discover', icon: 'compass', label: 'Discover' },
  { to: '/memory', icon: 'brain', label: 'Memory' },
  { to: '/artifacts', icon: 'layers', label: 'Artifacts' },
  { to: '/me', icon: 'user', label: 'Account' },
];

const TABS = [
  { to: '/chat', icon: 'chat', label: 'Chats' },
  { to: '/agents', icon: 'bot', label: 'Agents' },
  { to: '/discover', icon: 'compass', label: 'Discover' },
  { to: '/memory', icon: 'brain', label: 'Memory' },
  { to: '/artifacts', icon: 'layers', label: 'Artifacts' },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { db, route, navigate, toasts, setSettings } = useApp();
  const active = (to: string) => route === to || route.startsWith(to + '/');
  const dark = db.settings.theme === 'dark';
  const alerts = db.automations.filter((a) => a.enabled !== false).length;

  return (
    <div className="app">
      <nav className="rail" aria-label="Primary">
        <div className="rail-top">
          <button className="rail-logo" onClick={() => navigate('/chat')} aria-label="NsPace home">
            <Monogram size={34} />
          </button>
        </div>

        {RAIL.map((n) => (
          <button
            key={n.to}
            className={`navbtn${active(n.to) ? ' on' : ''}`}
            onClick={() => navigate(n.to)}
            aria-label={n.label}
          >
            <Icon name={n.icon} size={20} />
            <span className="tip">{n.label}</span>
          </button>
        ))}

        <div className="rail-spacer" />

        <button
          className="navbtn"
          onClick={() => setSettings({ theme: dark ? 'light' : 'dark' })}
          aria-label="Toggle theme"
        >
          <Icon name={dark ? 'sun' : 'moon'} size={19} />
          <span className="tip">{dark ? 'Light' : 'Dark'}</span>
        </button>
        <button
          className={`navbtn${active('/download') ? ' on' : ''}`}
          onClick={() => navigate('/download')}
          aria-label="Download"
        >
          <Icon name="download" size={19} />
          <span className="tip">Get the app</span>
        </button>
        <button
          className={`navbtn${active('/studio') ? ' on' : ''}`}
          onClick={() => navigate('/studio/new')}
          aria-label="Create"
        >
          <Icon name="rocket" size={19} />
          <span className="tip">Create</span>
        </button>
        <button
          className="navbtn bellbtn"
          onClick={() => navigate('/automations')}
          aria-label={`${alerts} automations`}
        >
          <Icon name="bell" size={19} />
          {alerts > 0 && <span className="railbadge">{alerts}</span>}
          <span className="tip">{alerts} automations</span>
        </button>
        <button className="rail-ava" onClick={() => navigate('/me')} aria-label="Account">
          <span className="avatar" style={{ background: 'linear-gradient(135deg,#34C759,#0A84FF)' }}>
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

      <nav className="tabbar" aria-label="Tabs">
        {TABS.map((t) => (
          <button
            key={t.to}
            className={`tabbtn${active(t.to) ? ' on' : ''}`}
            onClick={() => navigate(t.to)}
            aria-label={t.label}
          >
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

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
