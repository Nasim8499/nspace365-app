import React, { useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import { relTime } from '../lib/util';

const FOLDERS = ['All Work', 'Websites', 'Documents', 'Media', 'Messages', 'Meetings', 'Automations'];

export default function Artifacts() {
  const { db, navigate, deleteArtifact, updateArtifact, toast } = useApp();
  const [folder, setFolder] = useState('All Work');
  const [tab, setTab] = useState<'All' | 'Created by me' | 'Saved' | 'Memory'>('All');
  const [q, setQ] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const list = useMemo(
    () =>
      db.artifacts.filter((a) => {
        const inFolder =
          folder === 'All Work' ? true : a.folder === folder || (folder === 'Automations' && a.tags.includes('automation'));
        const inTab =
          tab === 'All'
            ? true
            : tab === 'Saved'
              ? !!a.saved
              : tab === 'Memory'
                ? a.tags.includes('memory') || a.folder === 'Messages'
                : true;
        const inQ = !q || a.title.toLowerCase().includes(q.toLowerCase());
        return inFolder && inTab && inQ;
      }),
    [db.artifacts, folder, tab, q]
  );

  return (
    <div className="chatwrap">
      <aside className="listpane pane glass">
        <div className="listhead">
          <div className="col" style={{ flex: 1 }}>
            <div className="h2">Artifacts</div>
            <div className="hint">{db.artifacts.length} items</div>
          </div>
          <button className="iconbtn" title="New doc" onClick={() => navigate('/studio/new')}>
            <Icon name="plus" size={18} />
          </button>
        </div>
        <div style={{ padding: '0 14px 10px' }}>
          <div className="search">
            <Icon name="search" size={14} />
            <input
              className="input"
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="convlist scroll">
          {FOLDERS.map((f) => (
            <button
              key={f}
              className={`conv${folder === f ? ' on' : ''}`}
              onClick={() => setFolder(f)}
            >
              <span
                className="avatar"
                style={{ background: 'var(--grad-soft)', color: 'var(--blue)' }}
              >
                <Icon name={f === 'Automations' ? 'bolt' : 'folder'} size={15} />
              </span>
              <span className="body">
                <span className="name">{f}</span>
                <span className="prev">
                  {f === 'All Work'
                    ? 'Everything'
                    : `${db.artifacts.filter((a) => a.folder === f || (f === 'Automations' && a.tags.includes('automation'))).length} items`}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="threadpane pane glass">
        <div className="threadhead">
          <div className="tabs">
            {(['All', 'Created by me', 'Saved', 'Memory'] as const).map((t) => (
              <button key={t} className={`tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button
            className={`iconbtn${view === 'grid' ? ' on' : ''}`}
            onClick={() => setView('grid')}
            title="Grid"
          >
            <Icon name="grid" size={16} />
          </button>
          <button
            className={`iconbtn${view === 'list' ? ' on' : ''}`}
            onClick={() => setView('list')}
            title="List"
          >
            <Icon name="list" size={16} />
          </button>
        </div>

        <div className="thread scroll">
          {!list.length ? (
            <div className="empty">
              <div className="big">
                <Icon name="layers" size={24} />
              </div>
              <div style={{ fontWeight: 650, color: 'var(--ink)' }}>Nothing here yet</div>
              <div className="hint" style={{ maxWidth: 380 }}>
                Your library starts here. Everything you create or save lands here, versioned v1, v2…
              </div>
              <div className="emptycards">
                <button
                  className="card emptycard"
                  onClick={() => navigate('/studio/new')}
                >
                  <span className="col" style={{ flex: 1, textAlign: 'left' }}>
                    <span className="ectitle">Create a cloud document</span>
                    <span className="hint">Start from a blank page.</span>
                  </span>
                  <Icon name="arrowRight" size={16} />
                </button>
                <button className="card emptycard" onClick={() => navigate('/discover')}>
                  <span className="col" style={{ flex: 1, textAlign: 'left' }}>
                    <span className="ectitle">Build a website with an agent</span>
                    <span className="hint">Describe it, and an agent builds it.</span>
                  </span>
                  <Icon name="arrowRight" size={16} />
                </button>
                <button className="card emptycard" onClick={() => navigate('/chat')}>
                  <span className="col" style={{ flex: 1, textAlign: 'left' }}>
                    <span className="ectitle">Save a message from a chat</span>
                    <span className="hint">Open the message menu, then Save to Artifacts.</span>
                  </span>
                  <Icon name="arrowRight" size={16} />
                </button>
              </div>
            </div>
          ) : view === 'grid' ? (
            <div className="grid">
              {list.map((a) => (
                <div className="card" key={a.id} style={{ padding: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: 108,
                      background:
                        'linear-gradient(135deg, rgba(10,132,255,0.12), rgba(94,92,230,0.10))',
                      display: 'grid',
                      placeItems: 'center',
                      borderBottom: '1px solid var(--line)',
                    }}
                  >
                    <Icon name="doc" size={30} className="muted" />
                  </div>
                  <div style={{ padding: 12 }}>
                    <div className="row">
                      <span className="badge">Markdown</span>
                      <span className="badge blue">v{a.version}</span>
                      <div style={{ flex: 1 }} />
                      <button
                        className="iconbtn"
                        style={{ width: 26, height: 26 }}
                        title="Save"
                        onClick={() => {
                          updateArtifact(a.id, { saved: !a.saved });
                          toast(a.saved ? 'Removed from saved' : 'Saved');
                        }}
                      >
                        <Icon name="bookmark" size={13} fill={!!a.saved} />
                      </button>
                    </div>
                    <div className="title" style={{ marginTop: 7 }}>
                      {a.title}
                    </div>
                    <div className="hint" style={{ marginTop: 3 }}>
                      {a.folder} · updated {relTime(a.updatedAt)}
                    </div>
                    <div className="row" style={{ marginTop: 10 }}>
                      <button className="btn xs" onClick={() => navigate(`/studio/${a.id}`)}>
                        Open
                      </button>
                      <div style={{ flex: 1 }} />
                      <button
                        className="iconbtn"
                        style={{ width: 26, height: 26 }}
                        title="Delete"
                        onClick={() => {
                          deleteArtifact(a.id);
                          toast('Deleted');
                        }}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {list.map((a) => (
                <button
                  key={a.id}
                  className="conv"
                  style={{ padding: 12 }}
                  onClick={() => navigate(`/studio/${a.id}`)}
                >
                  <span className="avatar" style={{ background: 'var(--grad-soft)', color: 'var(--blue)' }}>
                    <Icon name="doc" size={15} />
                  </span>
                  <span className="body">
                    <span className="top">
                      <span className="name">{a.title}</span>
                      <span className="date">v{a.version}</span>
                    </span>
                    <span className="prev">
                      {a.folder} · updated {relTime(a.updatedAt)}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={16} />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
