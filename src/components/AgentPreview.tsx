import React, { useRef, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from './Icon';
import Markdown from '../lib/md';
import { streamChat } from '../lib/llm';
import { skillsFor } from '../lib/skills';
import type { Agent } from '../types';

const PROMPTS = [
  'What can you do for me in one paragraph?',
  'Show me your working method as a short numbered list.',
  'Give a one-line example of your output.',
];

export default function AgentPreview({
  agent,
  onClose,
  onChat,
}: {
  agent: Agent;
  onClose: () => void;
  onChat: () => void;
}) {
  const { db } = useApp();
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('');
  const abort = useRef<AbortController | null>(null);
  const skills = skillsFor(agent.name);

  const run = async (text: string) => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setAnswer('');
    setStatus('Connecting to the model router…');
    abort.current = new AbortController();
    try {
      const res = await streamChat({
        model: 'auto',
        settings: db.settings,
        signal: abort.current.signal,
        messages: [
          { role: 'system', content: agent.system },
          { role: 'user', content: text },
        ],
        onToken: (d) => setAnswer((a) => a + d),
        onStatus: (s) => setStatus(s),
      });
      setModel(`${res.model} · ${res.provider}${res.demo ? ' (demo engine)' : ''}`);
      setStatus('');
    } catch (e) {
      if (!(e as Error).name.includes('abort')) setStatus('Failed: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal agentpreview" role="dialog" aria-label={`${agent.name} preview`} data-testid="agent-preview">
        <div className="ap-head">
          <span className="avatar lg" style={{ background: agent.color }}>
            {agent.initials}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row" style={{ gap: 8 }}>
              <div className="h2" style={{ fontSize: 17 }}>{agent.name}</div>
              <span className="badge">{agent.category}</span>
              <span className="livepill">
                <span className="dot live" /> live preview
              </span>
            </div>
            <div className="sub" style={{ fontSize: 12.5 }}>{agent.tagline}</div>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close preview">
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="ap-body">
          <div className="ap-left">
            <div className="label">System prompt</div>
            <p className="apprompt">{agent.system}</p>
            <div className="label" style={{ marginTop: 12 }}>Skills wired in</div>
            {skills.length ? (
              <div className="apskills">
                {skills.map((s) => (
                  <span className="badge blue" key={s.id}>
                    <Icon name={s.icon} size={11} /> {s.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="sub" style={{ fontSize: 12 }}>
                General agent loop: memory, tools, streaming answers. Visa skills attach to the Visa Automate agents.
              </p>
            )}
            <div className="label" style={{ marginTop: 12 }}>Try a prompt</div>
            <div className="apchips">
              {PROMPTS.map((pr) => (
                <button
                  className="chip"
                  key={pr}
                  onClick={() => {
                    setInput(pr);
                    run(pr);
                  }}
                  disabled={busy}
                >
                  {pr}
                </button>
              ))}
            </div>
          </div>

          <div className="ap-right">
            <div className="ap-answer" data-testid="ap-answer">
              {answer ? (
                <Markdown text={answer} />
              ) : busy ? (
                <div className="apthinking">
                  <span className="dot live" /> {status || 'Thinking…'}
                </div>
              ) : (
                <div className="dashempty" style={{ border: 0 }}>
                  Run a prompt to see this agent answer in real time — same router, same streaming as chat.
                </div>
              )}
            </div>
            <div className="ap-input">
              <input
                className="input"
                placeholder={`Ask ${agent.name}…`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && run(input)}
                data-testid="ap-input"
              />
              {busy ? (
                <button className="btn sm" onClick={() => abort.current?.abort()}>
                  Stop
                </button>
              ) : (
                <button className="btn primary sm" onClick={() => run(input)} data-testid="ap-send">
                  <Icon name="send" size={14} /> Run
                </button>
              )}
            </div>
            <div className="ap-foot">
              <span className="sub" style={{ fontSize: 11 }}>{model || status || 'Auto routing with fallback'}</span>
              <span style={{ flex: 1 }} />
              <button className="btn xs" onClick={onChat}>
                Open full chat <Icon name="arrowRight" size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
