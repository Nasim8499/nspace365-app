import React, { useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import { relTime } from '../lib/util';

export default function Memory() {
  const { db, addMemory, deleteMemory, setSettings, toast } = useApp();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');

  const list = db.memories.filter((m) => !q || m.text.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <div className="pagehead">
        <div className="col" style={{ flex: 1 }}>
          <h1 className="h1">Memory</h1>
          <div className="sub" style={{ marginTop: 3 }}>
            What every agent knows about you. Stored on this device only.
          </div>
        </div>
        <div className="search" style={{ width: 240 }}>
          <Icon name="search" size={14} />
          <input
            className="input"
            placeholder="Search memory…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="pagebody scroll">
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="row">
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--grad-soft)',
                color: 'var(--blue)',
              }}
            >
              <Icon name="brain" size={18} />
            </span>
            <div className="col" style={{ flex: 1 }}>
              <div style={{ fontWeight: 650 }}>Use memory in every prompt</div>
              <div className="hint">
                Injects your saved context into the system prompt, like “Enhance prompt with memory”.
              </div>
            </div>
            <button
              className={`toggle${db.settings.preferMemory ? ' on' : ''}`}
              onClick={() => {
                setSettings({ preferMemory: !db.settings.preferMemory });
                toast(db.settings.preferMemory ? 'Memory off' : 'Memory on');
              }}
            >
              <i />
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <label className="label">Add a memory</label>
          <div className="row">
            <input
              className="input"
              placeholder="e.g. Our company is NsPace; reports go out on Mondays"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addMemory(text);
                  setText('');
                  toast('Memory saved');
                }
              }}
            />
            <button
              className="btn primary"
              disabled={!text.trim()}
              onClick={() => {
                addMemory(text);
                setText('');
                toast('Memory saved');
              }}
            >
              <Icon name="plus" size={14} /> Add
            </button>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>
            Agents also save a memory when you say “remember…”, “I prefer…” or “always…” in a chat.
          </p>
        </div>

        <div className="col" style={{ gap: 8 }}>
          {list.map((m) => (
            <div className="card" key={m.id} style={{ padding: 12 }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="badge blue">{m.source}</span>
                <div style={{ flex: 1, fontSize: 14, lineHeight: 1.5 }}>{m.text}</div>
                <span className="hint">{relTime(m.createdAt)}</span>
                <button
                  className="iconbtn"
                  style={{ width: 28, height: 28 }}
                  onClick={() => {
                    deleteMemory(m.id);
                    toast('Memory removed');
                  }}
                  title="Forget"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
          {!list.length && (
            <div className="empty">
              <div className="big">
                <Icon name="brain" size={24} />
              </div>
              <div className="hint">No memories yet.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
