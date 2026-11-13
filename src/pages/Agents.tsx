import React, { useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import { CATEGORIES } from '../lib/seed';
import { NewAgent } from './Chat';

export default function Agents() {
  const { db, newConversation, addAgent, toast } = useApp();
  const [tab, setTab] = useState<'Agents' | 'Agent Teams'>('Agents');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [custom, setCustom] = useState(false);

  const list = useMemo(
    () =>
      db.agents.filter(
        (a) =>
          (cat === 'All' || a.category === cat) &&
          (!q ||
            a.name.toLowerCase().includes(q.toLowerCase()) ||
            a.tagline.toLowerCase().includes(q.toLowerCase()))
      ),
    [db.agents, cat, q]
  );

  const teams = useMemo(() => {
    const byCat = new Map<string, typeof db.agents>();
    db.agents.forEach((a) => {
      const arr = byCat.get(a.category) || [];
      arr.push(a);
      byCat.set(a.category, arr);
    });
    return [...byCat.entries()].filter(([c]) => cat === 'All' || c === cat);
  }, [db.agents, cat]);

  return (
    <div className="page">
      <div className="pagehead">
        <div className="tabs">
          {(['Agents', 'Agent Teams'] as const).map((t) => (
            <button key={t} className={`tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div className="search" style={{ width: 240 }}>
          <Icon name="search" size={14} />
          <input
            className="input"
            placeholder="Search agents…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button className="btn dark" onClick={() => setCustom(true)}>
          <Icon name="plus" size={15} /> Create My Own Agent
        </button>
      </div>

      <div className="pagebody scroll">
        <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
          {CATEGORIES.map((c) => (
            <button key={c} className={`pill${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="row" style={{ marginBottom: 10 }}>
          <span className="sub">Created by: NsPace · {list.length} agents</span>
        </div>

        {tab === 'Agents' ? (
          <div className="grid">
            {list.map((a) => (
              <div className="card" key={a.id}>
                <div className="row" style={{ alignItems: 'flex-start', gap: 11 }}>
                  <span className="avatar lg" style={{ background: a.color }}>
                    {a.initials}
                  </span>
                  <div className="col" style={{ flex: 1, minWidth: 0 }}>
                    <div className="row">
                      <div className="title" style={{ flex: 1 }}>
                        {a.name}
                      </div>
                      {!a.builtin && <span className="badge blue">Mine</span>}
                    </div>
                    <div className="desc">{a.tagline}</div>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <span className="badge">{a.category}</span>
                  <div style={{ flex: 1 }} />
                  <button className="btn xs" onClick={() => newConversation(a.id)}>
                    Chat <Icon name="arrowRight" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid">
            {teams.map(([category, members]) => (
              <div className="card" key={category}>
                <div className="row" style={{ gap: 8 }}>
                  <div className="row" style={{ marginLeft: 0 }}>
                    {members.slice(0, 4).map((m, i) => (
                      <span
                        key={m.id}
                        className="avatar"
                        style={{
                          background: m.color,
                          marginLeft: i ? -8 : 0,
                          border: '2px solid var(--glass-strong)',
                        }}
                      >
                        {m.initials}
                      </span>
                    ))}
                  </div>
                  <div className="col" style={{ flex: 1 }}>
                    <div className="title">{category} room</div>
                    <div className="hint">{members.length} agents · pick who answers</div>
                  </div>
                </div>
                <div className="desc" style={{ marginTop: 8 }}>
                  {members.map((m) => m.name).join(', ')}
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <div style={{ flex: 1 }} />
                  <button className="btn xs" onClick={() => newConversation(members[0].id)}>
                    Open room
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {custom && (
        <NewAgent
          onClose={() => setCustom(false)}
          onCreate={(a) => {
            addAgent(a);
            setCustom(false);
            toast('Agent created');
          }}
        />
      )}
    </div>
  );
}
