import React, { useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import { cadenceLabel, fmtDateTime, relTime } from '../lib/util';
import type { Cadence } from '../types';

const TEMPLATES: { title: string; icon: string; desc: string; prompt: string; cadence: Cadence }[] = [
  { title: 'Meeting reminder + prep', icon: 'bell', desc: 'Briefs you before every meeting with notes and open items.', prompt: 'Prepare a meeting brief: context, open items and the three questions I should ask.', cadence: 'daily' },
  { title: 'Daily work brief', icon: 'doc', desc: 'One morning brief across chats, files and deadlines.', prompt: 'Write my daily work brief from open chats, automations and visa cases.', cadence: 'daily' },
  { title: 'Competitor / industry monitor', icon: 'globe', desc: 'Watches the market and flags what actually changed.', prompt: 'Scan competitor and industry news, then flag anything that changes my plan.', cadence: 'daily' },
  { title: 'Expert group research', icon: 'search', desc: 'Runs a panel-style research pass with sources.', prompt: 'Research this topic as a panel of experts and return a sourced summary.', cadence: 'weekly' },
  { title: 'Make a deck / report', icon: 'layers', desc: 'Turns the latest findings into a deck outline.', prompt: 'Build a slide deck outline with a clear storyline from the newest findings.', cadence: 'weekly' },
  { title: 'Build a webpage / tool', icon: 'browser', desc: 'Drafts a page or internal tool from a description.', prompt: 'Draft a single-page website and an internal tool spec for this task.', cadence: 'weekly' },
  { title: 'Break down & assign tasks', icon: 'list', desc: 'Splits a goal into owners and deadlines.', prompt: 'Break the goal into tasks with owners, effort and deadlines.', cadence: 'weekly' },
  { title: 'Reply in my voice', icon: 'edit', desc: 'Drafts replies that sound like you, ready to send.', prompt: 'Draft replies in my voice for the messages waiting on me today.', cadence: 'daily' },
  { title: 'Investment / market research', icon: 'star', desc: 'Tracks a watchlist with a weekly verdict.', prompt: 'Research my watchlist and return a verdict with risks and sources.', cadence: 'weekly' },
  { title: 'Drive a goal (deck, launch…)', icon: 'compass', desc: 'Keeps one long goal moving with weekly checkpoints.', prompt: 'Advance my long-running goal: report progress, blockers and the next move.', cadence: 'weekly' },
  { title: 'Inbox triage & follow-ups', icon: 'send', desc: 'Sorts what matters and drafts the follow-ups.', prompt: 'Triage my inbox: what needs an answer, what can wait, what to file.', cadence: 'daily' },
  { title: 'Cross-timezone relay', icon: 'clock', desc: 'Hands the work to the next timezone cleanly.', prompt: 'Write a handoff note for the next timezone: state, decisions and next steps.', cadence: 'daily' },
];

export default function Automations() {
  const { db, addAutomation, updateAutomation, deleteAutomation, runAutomation, toast, navigate, runLog } =
    useApp();
  const [tab, setTab] = useState<'My Automations' | 'Work' | 'Life'>('My Automations');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const list = db.automations.filter((a) => !q || a.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <div className="pagehead">
        <div className="col" style={{ flex: 1 }}>
          <h1 className="h1">Automations</h1>
          <div className="sub" style={{ marginTop: 3 }}>
            Real scheduled runs — each fire streams an answer and saves it as a versioned artifact.
          </div>
        </div>
        <div className="search" style={{ width: 240 }}>
          <Icon name="search" size={14} />
          <input
            className="input"
            placeholder="Search my automations…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button className="btn dark" onClick={() => setCreating(true)}>
          <Icon name="plus" size={15} /> New automation
        </button>
      </div>

      <div className="pagebody scroll">
        <div className="tabs" style={{ marginBottom: 12 }}>
          {(['My Automations', 'Work', 'Life'] as const).map((t) => (
            <button key={t} className={`tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {tab !== 'My Automations' || !list.length ? (
          <div style={{ marginBottom: 18 }}>
            <div className="h2" style={{ fontSize: 14, marginBottom: 8 }}>
              Start from a template
            </div>
            <div className="automgrid">
              {TEMPLATES.filter((t) =>
                !q ? true : t.title.toLowerCase().includes(q.toLowerCase())
              ).map((t) => (
                <button
                  className="card autocard"
                  key={t.title}
                  onClick={() => {
                    const agent = db.agents[0];
                    if (!agent) {
                      toast('Create an agent first');
                      navigate('/agents');
                      return;
                    }
                    addAutomation({
                      title: t.title,
                      agentId: agent.id,
                      prompt: t.prompt,
                      cadence: t.cadence,
                      hour: 9,
                      minute: 0,
                      weekday: 1,
                      enabled: true,
                    });
                    toast(`“${t.title}” scheduled with ${agent.name}`);
                  }}
                >
                  <span className="autoico">
                    <Icon name={t.icon} size={16} />
                  </span>
                  <span className="autotitle">{t.title}</span>
                  <span className="autodesc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="col" style={{ gap: 9 }}>
          {list.map((a) => {
            const agent = db.agents.find((x) => x.id === a.agentId);
            const isRunning = running === a.id;
            return (
              <div className="card" key={a.id} style={{ padding: 14 }}>
                <div className="row" style={{ gap: 12 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'var(--grad-soft)',
                      color: 'var(--blue)',
                      flex: '0 0 auto',
                    }}
                  >
                    <Icon name="bolt" size={18} fill />
                  </span>
                  <button
                    className="col"
                    style={{ flex: 1, minWidth: 0, textAlign: 'left' }}
                    onClick={() => setOpen(open === a.id ? null : a.id)}
                  >
                    <span style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em' }}>
                      {a.title}
                    </span>
                    <span className="hint" style={{ marginTop: 2 }}>
                      {cadenceLabel(a.cadence, a.hour, a.minute, a.weekday)} · {agent?.name}
                      {a.enabled
                        ? ` · next ${fmtDateTime(a.nextRun)}`
                        : ' · paused'}
                    </span>
                  </button>
                  <button
                    className="btn xs"
                    disabled={isRunning}
                    onClick={async () => {
                      setRunning(a.id);
                      await runAutomation(a.id);
                      setRunning(null);
                    }}
                  >
                    {isRunning ? 'Running…' : 'Run now'}
                  </button>
                  <button
                    className={`toggle${a.enabled ? ' on' : ''}`}
                    onClick={() => {
                      updateAutomation(a.id, { enabled: !a.enabled });
                      toast(a.enabled ? 'Automation paused' : 'Automation enabled');
                    }}
                    aria-label="Toggle automation"
                  >
                    <i />
                  </button>
                </div>

                {open === a.id && (
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                    <label className="label">Prompt</label>
                    <div className="bubble agent" style={{ maxWidth: '100%', marginBottom: 12 }}>
                      {a.prompt}
                    </div>
                    <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
                      <span className="badge">{a.runs.length} runs</span>
                      {a.lastRun && <span className="badge">last {relTime(a.lastRun)}</span>}
                      <span className="badge blue">{agent?.name}</span>
                      <div style={{ flex: 1 }} />
                      <button
                        className="btn xs danger"
                        onClick={() => {
                          deleteAutomation(a.id);
                          toast('Automation deleted');
                        }}
                      >
                        <Icon name="trash" size={12} /> Delete
                      </button>
                    </div>
                    {a.runs.length === 0 && (
                      <div className="hint">
                        No runs yet. Hit “Run now” to see the full loop — it writes a real artifact.
                      </div>
                    )}
                    <div className="col" style={{ gap: 7 }}>
                      {a.runs.map((r) => (
                        <div key={r.id} className="row" style={{ gap: 8 }}>
                          <span className={`badge ${r.status === 'ok' ? 'green' : 'red'}`}>
                            {r.status}
                          </span>
                          <span className="hint" style={{ flex: 1, minWidth: 0 }}>
                            {fmtDateTime(r.at)} · {r.summary.slice(0, 90)}
                          </span>
                          {r.artifactId && (
                            <button
                              className="chip"
                              onClick={() => navigate(`/studio/${r.artifactId}`)}
                            >
                              Open artifact
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!list.length && (
            <div className="empty">
              <div className="big">
                <Icon name="bolt" size={24} />
              </div>
              <div style={{ fontWeight: 650, color: 'var(--ink)' }}>No automations</div>
              <div className="hint">Schedule an agent to run hourly, daily, weekly or monthly.</div>
              <button className="btn primary" onClick={() => setCreating(true)}>
                <Icon name="plus" size={14} /> New automation
              </button>
            </div>
          )}
        </div>

        {runLog.length > 0 && (
          <>
            <div className="section" style={{ paddingLeft: 2 }}>
              Live run log
            </div>
            <div className="card" style={{ padding: 12 }}>
              {runLog.slice(0, 8).map((l, i) => (
                <div key={i} className="hint" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {l}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {creating && <NewAutomation onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewAutomation({ onClose }: { onClose: () => void }) {
  const { db, addAutomation } = useApp();
  const [title, setTitle] = useState('');
  const [agentId, setAgentId] = useState(db.agents[0]?.id || '');
  const [prompt, setPrompt] = useState('');
  const [cadence, setCadence] = useState<Cadence>('weekly');
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [weekday, setWeekday] = useState(1);

  return (
    <Modal
      title="New automation"
      sub="The scheduler runs inside the app and keeps going while it is open"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!title.trim() || !prompt.trim()}
            onClick={() => {
              addAutomation({
                title: title.trim(),
                agentId,
                prompt: prompt.trim(),
                cadence,
                hour,
                minute,
                weekday,
                enabled: true,
              });
              onClose();
            }}
          >
            Create
          </button>
        </>
      }
    >
      <label className="label">Title</label>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Monday pipeline review" />
      <div style={{ height: 12 }} />
      <label className="label">Agent</label>
      <select className="select" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
        {db.agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <div style={{ height: 12 }} />
      <label className="label">Prompt</label>
      <textarea
        className="textarea"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="What should it produce every time it fires?"
      />
      <div style={{ height: 12 }} />
      <label className="label">Schedule</label>
      <div className="row wrap">
        <select
          className="select"
          style={{ width: 130 }}
          value={cadence}
          onChange={(e) => setCadence(e.target.value as Cadence)}
        >
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        {cadence === 'weekly' && (
          <select
            className="select"
            style={{ width: 140 }}
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
          >
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
              (d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              )
            )}
          </select>
        )}
        {cadence !== 'hourly' && (
          <select
            className="select"
            style={{ width: 100 }}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
          >
            {Array.from({ length: 24 }).map((_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        )}
        <select
          className="select"
          style={{ width: 100 }}
          value={minute}
          onChange={(e) => setMinute(Number(e.target.value))}
        >
          {[0, 15, 30, 45].map((m) => (
            <option key={m} value={m}>
              :{String(m).padStart(2, '0')}
            </option>
          ))}
        </select>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>
        Runs are tracked locally with a next-fire time, so a weekly automation really fires next
        Monday at the time you pick.
      </p>
    </Modal>
  );
}
