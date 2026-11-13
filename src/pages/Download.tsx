import React from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import { Monogram, Wordmark } from '../components/Logo';

export default function Download() {
  const { toast } = useApp();
  const prompt = (window as any).__nspaceInstall;

  const install = async () => {
    if (!prompt) {
      toast('Use the browser menu → “Add to Home Screen”');
      return;
    }
    prompt.prompt();
    const res = await prompt.userChoice;
    if (res?.outcome === 'accepted') toast('Installing NsPace…');
    (window as any).__nspaceInstall = null;
  };

  const devices = [
    { icon: 'phone', name: 'iPhone / iPad', note: 'Safari → Share → Add to Home Screen' },
    { icon: 'bot', name: 'Android', note: 'Chrome → menu → Install app' },
    { icon: 'globe', name: 'Desktop web', note: 'Chrome / Edge → install icon in the address bar' },
    { icon: 'grid', name: 'macOS', note: 'Add to Dock from Safari 17+' },
    { icon: 'doc', name: 'Windows', note: 'Edge → Apps → Install this site' },
  ];

  return (
    <div className="page">
      <div className="pagebody scroll">
        <div style={{ textAlign: 'center', padding: '36px 0 20px' }}>
          <div style={{ display: 'grid', placeItems: 'center', marginBottom: 14 }}>
            <Monogram size={66} />
          </div>
          <Wordmark size={30} />
          <h1 className="h1" style={{ marginTop: 16 }}>
            Get NsPace on every device
          </h1>
          <p className="sub" style={{ maxWidth: 520, margin: '8px auto 0' }}>
            One installable app: the same agents, the same memory, the same chats. Installable PWA
            today, native store builds from the same codebase.
          </p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
            <button className="btn primary" onClick={install}>
              <Icon name="download" size={15} /> Install app
            </button>
            <button className="btn" onClick={() => toast('Open Settings → Install to pin it')}>
              <Icon name="star" size={15} /> Add to Home Screen
            </button>
          </div>
        </div>

        <div className="devices">
          {devices.map((d) => (
            <div className="device" key={d.name}>
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--grad-soft)',
                  color: 'var(--blue)',
                }}
              >
                <Icon name={d.icon} size={20} />
              </span>
              <div style={{ fontWeight: 650, fontSize: 14 }}>{d.name}</div>
              <div className="hint">{d.note}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 18, marginTop: 16, marginBottom: 12 }}>
          <div className="h2" style={{ marginBottom: 8 }}>
            What ships in v1.0
          </div>
          <div className="col" style={{ gap: 7 }}>
            {[
              'Chat with streaming, stop, retry, feedback and attachment context',
              'Agent store with categories and your own agents',
              'Real scheduled automations that produce versioned artifacts',
              'Memory that is injected into every prompt',
              'Artifacts with Studio editor and v1 → vN versioning',
              'Voice dictation and voice call loop (Web Speech APIs)',
              'Provider router: Llama 4 Scout, Mistral Small 3, gpt-oss-120b, GPT-4o, GPT-4o mini, Gemini',
              'Installable PWA with offline shell, light and dark liquid glass',
            ].map((x) => (
              <div className="row" key={x} style={{ gap: 8 }}>
                <span style={{ color: 'var(--green)' }}>
                  <Icon name="check" size={15} />
                </span>
                <span style={{ fontSize: 13.5 }}>{x}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
