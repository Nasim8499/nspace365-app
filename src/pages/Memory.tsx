import React, { useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import { relTime } from '../lib/util';

const FILTERS = ['All', 'Updates', 'Tags'] as const;
const NAV = ['Overview', 'My Profile', 'Next Actions', 'My Artifacts', 'My Meetings'] as const;

export default function Memory() {
  const { db, addMemory, deleteMemory, setSettings, toast, navigate } = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [nav, setNav] = useState<(typeof NAV)[number]>('Overview');
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  const all = db.memories;
  const list = useMemo(
    () =>
      all
        .filter((m) => !q || m.text.toLowerCase().includes(q.toLowerCase()))
        .filter((m) => (filter === 'All' ? true : filter === 'Updates' ? m.source === 'chat' : true))
        .sort((a, b) => b.createdAt - a.createdAt),
    [all, q, filter]
  );

  const current = list.find((m) => m.id === selected) || list[0];

  const save = () => {
    if (!draft.trim()) return;
    addMemory(draft.trim(), 'manual');
    setDraft('');
    setWriting(false);
    toast('Saved to memory');
  };

  const dream = () => {
    if (!all.length) {
      toast('Save a few memories first');
      return;
    }
    const themes = all.slice(0, 6).map((m) => m.text.replace(/\s+/g, ' ').slice(0, 90));
    addMemory(
      `Consolidated brief: ${themes.join(' · ')}`.slice(0, 900),
      'manual'
    );
    toast('Dream wrote a consolidated brief');
  };

  return (
    <div className="chatwrap memwrap">
      <aside className="listpane pane glass memside">
        <div className="memhead">
          <div className="col" style={{ flex: 1 }}>
            <div className="h2" style={{ fontSize: 15 }}>
              Memory
            </div>
            <div className="hint">{all.length} items</div>
          </div>
          <button className="btn sm primary" onClick={() => setWriting((v) => !v)}>
            <Icon name="plus" size={13} /> New
          </button>
        </div>

        <div style={{ padding: '0 12px 8px' }}>
          <div className="search">
            <Icon name="search" size={14} />
            <input
              className="input"
              placeholder="Search topics…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="memfilters">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`pill${filter === f ? ' on' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
              {f === 'All' ? ` ${all.length}` : ''}
            </button>
          ))}
        </div>

        <div className="memnav">
          {NAV.map((n) => (
            <button
              key={n}
              className={`memnavitem${nav === n ? ' on' : ''}`}
              onClick={() => {
                setNav(n);
                if (n === 'My Artifacts') navigate('/artifacts');
                else if (n === 'My Meetings') toast('Meetings sync from your automations');
              }}
            >
              <Icon
                name={
                  n === 'Overview'
                    ? 'grid'
                    : n === 'My Profile'
                      ? 'user'
                      : n === 'Next Actions'
                        ? 'check'
                        : n === 'My Artifacts'
                          ? 'layers'
                          : 'cal'
                }
                size={14}
              />
              {n}
            </button>
          ))}
        </div>

        <div className="convlist scroll" style={{ paddingTop: 4 }}>
          <div className="section" style={{ cursor: 'default' }}>
            <Icon name="chevronDown" size={12} /> Uncategorized · {list.length}
          </div>
          {list.map((m) => (
            <button
              key={m.id}
              className={`conv${current?.id === m.id ? ' on' : ''}`}
              onClick={() => setSelected(m.id)}
            >
              <span className="avatar" style={{ background: 'var(--grad-soft)', color: 'var(--blue)' }}>
                <Icon name="brain" size={14} />
              </span>
              <span className="body">
                <span className="name">{m.text.slice(0, 42)}</span>
                <span className="prev">
                  {m.source === 'chat' ? 'from a chat' : 'you saved this'} · {relTime(m.createdAt)}
                </span>
              </span>
            </button>
          ))}
          {!list.length && (
            <div className="hint" style={{ padding: '14px 12px' }}>
              Nothing matches “{q}”. Save a memory with New.
            </div>
          )}
        </div>

        <button
          className="card memtoggle"
          onClick={() => {
            setSettings({ preferMemory: !db.settings.preferMemory });
            toast(db.settings.preferMemory ? 'Memory off' : 'Memory on');
          }}
        >
          <span className="col" style={{ flex: 1, textAlign: 'left' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Use memory in every prompt</span>
            <span className="hint">Injected into the system prompt</span>
          </span>
          <span className={`toggle${db.settings.preferMemory ? ' on' : ''}`} />
        </button>
      </aside>

      <section className="threadpane pane glass memeditor">
        <header className="memedithead">
          <div className="col" style={{ flex: 1, minWidth: 0 }}>
            <div className="h1" style={{ fontSize: 20 }}>
              {current ? current.text.split(/[.!?]/)[0].slice(0, 52) : 'Untitled page'}
            </div>
            <div className="hint">
              {current ? `${current.source === 'chat' ? 'From a chat' : 'Saved by you'} · ${relTime(current.createdAt)}` : 'Add a summary to keep the thread of it'}
            </div>
          </div>
          <button className="btn sm" onClick={dream}>
            <Icon name="sparkles" size={13} /> Dream
          </button>
          <button
            className="iconbtn"
            title="Copy"
            onClick={() => {
              if (!current) return;
              void navigator.clipboard?.writeText(current.text);
              toast('Copied');
            }}
          >
            <Icon name="copy" size={15} />
          </button>
          <button
            className="iconbtn"
            title="Share"
            onClick={() => toast('Sharing arrives with team workspaces')}
          >
            <Icon name="share" size={15} />
          </button>
          <button
            className="iconbtn"
            title="Delete"
            onClick={() => {
              if (!current) return;
              deleteMemory(current.id);
              setSelected(null);
              toast('Memory deleted');
            }}
          >
            <Icon name="trash" size={15} />
          </button>
        </header>

        <div className="memtoolbar">
          {['B', 'I', 'U', 'H1', 'H2', '•', '1.', '❝'].map((t) => (
            <button key={t} className="membtn" title={`Format ${t}`} onClick={() => toast('Formatting applies in Studio docs')}>
              {t}
            </button>
          ))}
          <div className="grow" />
          <span className="hint">
            Saved on this device · {relTime(current?.createdAt || Date.now())}
          </span>
        </div>

        <div className="thread scroll" style={{ padding: '16px 18px' }}>
          <div className="memtagrow">
            <span className="memtag">memory</span>
            <span className="memtag">context</span>
            <button className="memtag add" onClick={() => toast('Tags are auto-assigned per memory')}>
              + add tag
            </button>
          </div>

          <div className="h2" style={{ fontSize: 13, margin: '16px 0 6px' }}>
            Overview
          </div>
          <div className="membody">
            {current ? (
              current.text
            ) : (
              <>
                Everything your agents know about you lives here. Tap <b>New</b> to add a fact, or
                let chats save memories on their own.
              </>
            )}
          </div>

          {writing && (
            <div className="card" style={{ marginTop: 14, padding: 12 }}>
              <textarea
                className="textarea"
                style={{ minHeight: 92 }}
                placeholder="What should every agent remember?"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="row" style={{ marginTop: 8, justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn sm" onClick={() => setWriting(false)}>
                  Cancel
                </button>
                <button className="btn sm primary" onClick={save}>
                  Save memory
                </button>
              </div>
            </div>
          )}

          {!writing && (
            <button
              className="membody hint"
              style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, cursor: 'pointer' }}
              onClick={() => setWriting(true)}
            >
              Start writing…
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
