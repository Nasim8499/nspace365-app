import React, { useRef, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import { Monogram, Wordmark } from '../components/Logo';
import { TIERS, availableTiers } from '../lib/llm';
import { downloadText, estimateTokens } from '../lib/util';
import type { ModelKey } from '../types';

export default function Me() {
  const { db, setSettings, signOut, toast } = useApp();
  const s = db.settings;
  const [tab, setTab] = useState<'Posts' | 'Favorites' | 'Likes'>('Posts');
  const fileRef = useRef<HTMLInputElement>(null);

  const messages = db.conversations.reduce((n, c) => n + c.messages.length, 0);
  const tokens = db.conversations.reduce(
    (n, c) => n + c.messages.reduce((m, x) => m + estimateTokens(x.content), 0),
    0
  );
  const keysSet = availableTiers(s).length;

  const setKey = (k: keyof typeof s.keys, v: string) =>
    setSettings({ keys: { ...s.keys, [k]: v } });

  return (
    <div className="page">
      <div className="pagebody scroll">
        {/* profile */}
        <div className="card" style={{ padding: 20, marginTop: 6 }}>
          <div className="row" style={{ gap: 14 }}>
            <div
              className="avatar"
              style={{
                width: 62,
                height: 62,
                borderRadius: 20,
                fontSize: 22,
                background: 'linear-gradient(135deg,#34C759,#0A84FF)',
              }}
            >
              {(s.name || 'You')
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase()}
            </div>
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <Wordmark size={24} />
              <div style={{ fontWeight: 650, fontSize: 15, marginTop: 6 }}>
                {s.name || 'Your name'}
                <span style={{ color: 'var(--muted)', fontWeight: 500 }}> · @{s.handle || 'you'}</span>
              </div>
              <div className="row" style={{ gap: 16, marginTop: 6 }}>
                <span className="hint">
                  <b style={{ color: 'var(--ink)' }}>{messages}</b> messages
                </span>
                <span className="hint">
                  <b style={{ color: 'var(--ink)' }}>{db.artifacts.length}</b> artifacts
                </span>
                <span className="hint">
                  <b style={{ color: 'var(--ink)' }}>{keysSet}</b> engines live
                </span>
                <span className="hint">
                  <b style={{ color: 'var(--ink)' }}>~{tokens}</b> tokens
                </span>
              </div>
            </div>
            <button className="iconbtn" onClick={() => setTab('Posts')} title="Profile">
              <Icon name="user" size={18} />
            </button>
            <button className="iconbtn" onClick={() => signOut()} title="Sign out">
              <Icon name="logout" size={18} />
            </button>
          </div>
          <div className="tabs" style={{ marginTop: 14 }}>
            {(['Posts', 'Favorites', 'Likes'] as const).map((t) => (
              <button key={t} className={`tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="empty" style={{ padding: '24px 0 4px' }}>
            <div className="hint">
              {tab === 'Posts' && 'No posts yet. Share an artifact to build your feed.'}
              {tab === 'Favorites' && 'Saved artifacts and pinned chats show up here.'}
              {tab === 'Likes' && 'Answers you rate 👍 collect here.'}
            </div>
          </div>
        </div>

        {/* models */}
        <div className="card" style={{ padding: 18, marginTop: 14 }}>
          <div className="row" style={{ marginBottom: 4 }}>
            <Icon name="key" size={17} />
            <div className="h2">Models</div>
            <div style={{ flex: 1 }} />
            <span className={`badge ${keysSet ? 'green' : ''}`}>
              {keysSet ? `${keysSet} connected` : 'demo engine'}
            </span>
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            Keys stay in this browser (localStorage) and are sent only to the provider you pick. With
            no key, the on-device demo engine answers so everything still works.
          </p>

          <div className="col" style={{ gap: 10, marginTop: 12 }}>
            {TIERS.map((t) => {
              const k = t.provider as keyof typeof s.keys;
              return (
                <div key={t.key}>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 650, fontSize: 13.5 }}>{t.label}</span>
                    <span className="badge">{t.providerLabel}</span>
                    <span className="hint">{t.note}</span>
                  </div>
                  <input
                    className="input"
                    type="password"
                    placeholder={`${t.providerLabel} API key`}
                    value={s.keys[k]}
                    onChange={(e) => setKey(k, e.target.value)}
                    autoComplete="off"
                  />
                </div>
              );
            })}
            <div>
              <div className="row" style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 650, fontSize: 13.5 }}>Gemini model id</span>
                <span className="hint">whatever your key exposes — not hardcoded</span>
              </div>
              <input
                className="input"
                value={s.geminiModel}
                onChange={(e) => setSettings({ geminiModel: e.target.value })}
                placeholder="gemini-2.5-flash"
              />
            </div>
          </div>

          <div style={{ height: 14 }} />
          <label className="label">Default router</label>
          <select
            className="select"
            value={s.defaultModel}
            onChange={(e) => setSettings({ defaultModel: e.target.value as ModelKey })}
          >
            <option value="auto">Auto — fall through the chain (recommended)</option>
            {TIERS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* preferences */}
        <div className="card" style={{ padding: 18, marginTop: 14 }}>
          <div className="h2" style={{ marginBottom: 10 }}>
            Preferences
          </div>
          <Row
            title="Appearance"
            hint="Liquid Glass White, with full dark parity"
            right={
              <button
                className="btn sm"
                onClick={() => setSettings({ theme: s.theme === 'dark' ? 'light' : 'dark' })}
              >
                <Icon name={s.theme === 'dark' ? 'sun' : 'moon'} size={14} />
                {s.theme === 'dark' ? 'Light' : 'Dark'}
              </button>
            }
          />
          <Row
            title="Agentic mode"
            hint="Plan first, then execute with tools and memory"
            right={
              <button
                className={`toggle${s.agenticMode ? ' on' : ''}`}
                onClick={() => setSettings({ agenticMode: !s.agenticMode })}
              >
                <i />
              </button>
            }
          />
          <Row
            title="Memory in prompts"
            hint={`${db.memories.length} items injected`}
            right={
              <button
                className={`toggle${s.preferMemory ? ' on' : ''}`}
                onClick={() => setSettings({ preferMemory: !s.preferMemory })}
              >
                <i />
              </button>
            }
          />
        </div>

        {/* data */}
        <div className="card" style={{ padding: 18, marginTop: 14, marginBottom: 10 }}>
          <div className="h2" style={{ marginBottom: 10 }}>
            Your data
          </div>
          <Row
            title="Export everything"
            hint="Chats, artifacts, automations, memory as JSON"
            right={
              <button
                className="btn sm"
                onClick={() =>
                  downloadText('nspace-backup.json', JSON.stringify(db, null, 2), 'application/json')
                }
              >
                <Icon name="download" size={14} /> Export
              </button>
            }
          />
          <Row
            title="Import a backup"
            hint="Replaces everything currently on this device"
            right={
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const parsed = JSON.parse(await f.text());
                      localStorage.setItem('nspace.db.v3', JSON.stringify(parsed));
                      location.reload();
                    } catch {
                      toast('That file is not a valid NsPace backup');
                    }
                  }}
                />
                <button className="btn sm" onClick={() => fileRef.current?.click()}>
                  <Icon name="folder" size={14} /> Import
                </button>
              </>
            }
          />
          <Row
            title="Reset this device"
            hint="Deletes local data. Cannot be undone."
            right={
              <button
                className="btn sm danger"
                onClick={() => {
                  if (!confirm('Delete all local NsPace data on this device?')) return;
                  localStorage.removeItem('nspace.db.v3');
                  location.reload();
                }}
              >
                <Icon name="trash" size={14} /> Reset
              </button>
            }
          />
          <div className="row" style={{ marginTop: 14, gap: 10 }}>
            <Monogram size={22} />
            <span className="hint">
              NsPace · build 1.0.0 · local-first · your data stays on this device.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  title,
  hint,
  right,
}: {
  title: string;
  hint: string;
  right: React.ReactNode;
}) {
  return (
    <div
      className="row"
      style={{ padding: '11px 0', borderTop: '1px solid var(--line)', gap: 12 }}
    >
      <div className="col" style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <div className="hint">{hint}</div>
      </div>
      {right}
    </div>
  );
}
