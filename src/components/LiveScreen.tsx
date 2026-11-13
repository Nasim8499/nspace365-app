import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import type { Jurisdiction } from '../lib/knowledge';

export interface RunRow {
  portal: string;
  label: string;
  value: string;
  type: 'text' | 'date' | 'select' | 'file' | 'radio';
  options?: string[];
  required?: boolean;
}

interface Props {
  jurisdiction: Jurisdiction;
  rows: RunRow[];
  caseToken: string;
  applicantName: string;
  autoStart?: boolean;
  approvedReference?: string;
  onField?: (index: number, row: RunRow) => void;
  onHalt?: () => void;
  onFullscreen?: (on: boolean) => void;
}

type Phase = 'idle' | 'typing' | 'paused' | 'halted' | 'done';

export default function LiveScreen({
  jurisdiction,
  rows,
  caseToken,
  applicantName,
  autoStart = false,
  approvedReference,
  onField,
  onHalt,
  onFullscreen,
}: Props) {
  const [phase, setPhase] = useState<Phase>(autoStart ? 'typing' : 'idle');
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [log, setLog] = useState<{ at: number; text: string }[]>([]);
  const [full, setFull] = useState(false);
  const [reference, setReference] = useState(approvedReference || '');
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const push = (text: string) =>
    setLog((l) => [...l.slice(-60), { at: Date.now(), text }]);

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    clearTimers();
    if (phase !== 'typing') return;
    if (index >= rows.length) {
      setPhase('halted');
      push('HALT — reached the final review page. Payment and submit are locked until a human approves.');
      onHalt?.();
      return;
    }
    const row = rows[index];
    const target = row.value || '';
    let pos = 0;
    const startDelay = index === 0 ? 380 : 220;
    const tick = window.setInterval(() => {
      pos = Math.min(target.length, pos + Math.max(3, Math.ceil(target.length / 7)));
      setTyped(target.slice(0, pos));
      if (pos >= target.length) {
        window.clearInterval(tick);
        push(`Filled ${row.label}${target ? '' : ' (left blank on purpose)'}`);
        onField?.(index, row);
        setTyped('');
        setIndex((i) => i + 1);
      }
    }, 26);
    timers.current.push(tick as unknown as number);
    const kick = window.setTimeout(() => {
      push(row.type === 'file' ? `Attaching ${row.label}` : `Typing ${row.label}`);
    }, startDelay);
    timers.current.push(kick);
    return () => window.clearInterval(tick);
  }, [phase, index, rows.length]);

  const progress = Math.round((index / Math.max(rows.length, 1)) * 100);
  const current = rows[Math.min(index, rows.length - 1)];

  const approve = () => {
    const ref = `${jurisdiction.code}-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`;
    setReference(ref);
    setPhase('done');
    push(`Staff approved. Reference ${ref}. Payment step released to the counselor.`);
  };

  const restart = () => {
    clearTimers();
    setIndex(0);
    setTyped('');
    setLog([]);
    setReference('');
    setPhase('typing');
  };

  const toggleFull = () => {
    setFull((f) => {
      onFullscreen?.(!f);
      return !f;
    });
  };

  const filled = useMemo(() => rows.map((r, i) => (i < index ? r.value : '')), [rows, index]);

  const body = (
    <div className={`livescreen${full ? ' full' : ''}`}>
      <div className="ls-chrome">
        <span className="ls-dots">
          <i style={{ background: '#ff5f57' }} />
          <i style={{ background: '#febc2e' }} />
          <i style={{ background: '#28c840' }} />
        </span>
        <span className="ls-url">
          <Icon name="lock" size={13} />
          {jurisdiction.portalUrl.replace(/^https?:\/\//, '')}
        </span>
        <span className="ls-badge">
          <span className={`dot ${phase}`} />
          {phase === 'typing' ? 'Live run' : phase === 'halted' ? 'Halted for review' : phase === 'done' ? 'Filed' : phase === 'paused' ? 'Paused' : 'Ready'}
        </span>
        <span style={{ flex: 1 }} />
        {phase === 'typing' && (
          <button className="iconbtn" onClick={() => setPhase('paused')} aria-label="Pause">
            <Icon name="pause" size={15} />
          </button>
        )}
        {phase === 'paused' && (
          <button className="iconbtn" onClick={() => setPhase('typing')} aria-label="Resume">
            <Icon name="play" size={15} />
          </button>
        )}
        <button className="iconbtn" onClick={toggleFull} aria-label="Fullscreen">
          <Icon name={full ? 'shrink' : 'expand'} size={15} />
        </button>
      </div>

      <div className="ls-body">
        <div className="ls-form">
          <div className="ls-site">
            <div className="ls-site-mark">{jurisdiction.flag}</div>
            <div>
              <div className="h2" style={{ fontSize: 15 }}>{jurisdiction.portal}</div>
              <div className="sub" style={{ fontSize: 12 }}>
                {jurisdiction.form} · applicant {applicantName} · {caseToken}
              </div>
            </div>
          </div>

          <div className="ls-progress">
            <div style={{ width: `${Math.max(progress, 4)}%` }} />
          </div>

          <div className="ls-fields">
            {rows.map((r, i) => {
              const active = i === index && phase === 'typing';
              const value = active ? typed : filled[i];
              const state = i < index ? 'done' : active ? 'active' : 'todo';
              return (
                <div className={`ls-field ${state}`} key={r.portal + i}>
                  <span className="ls-flabel">
                    {r.label}
                    {r.required && <em>*</em>}
                  </span>
                  <span className={`ls-fvalue ${r.type}`} data-field={r.portal}>
                    {r.type === 'select' ? (
                      <span className="ls-select">
                        {value || '— select —'}
                        <Icon name="chevronDown" size={12} />
                      </span>
                    ) : r.type === 'file' ? (
                      value ? (
                        <span className="ls-file">
                          <Icon name="doc" size={12} /> {value}
                        </span>
                      ) : (
                        <span className="ls-placeholder">Choose file</span>
                      )
                    ) : value ? (
                      value
                    ) : (
                      <span className="ls-placeholder">&nbsp;</span>
                    )}
                    {active && <span className="ls-caret" />}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="ls-actions">
            <button className="btn dark sm" disabled>
              Continue
            </button>
            <button className="btn sm" disabled style={{ opacity: 0.5 }}>
              Save and exit
            </button>
            <span className="sub" style={{ marginLeft: 'auto', fontSize: 11.5 }}>
              Submit and pay are locked by the HITL guard
            </span>
          </div>
        </div>

        <aside className="ls-side">
          <div className="ls-stat">
            <span className="label" style={{ margin: 0 }}>Current step</span>
            <div className="ls-now">
              {phase === 'typing' ? current?.label : phase === 'halted' ? 'Final review — waiting for staff' : phase === 'done' ? 'Approved and filed' : 'Idle'}
            </div>
            <div className="ls-count">
              {Math.min(index, rows.length)} / {rows.length} fields · {progress}%
            </div>
          </div>
          <div className="ls-feed">
            {log.length === 0 && <div className="sub" style={{ fontSize: 12 }}>Waiting for the run to start…</div>}
            {log
              .slice()
              .reverse()
              .map((l, i) => (
                <div className="ls-feed-row" key={i}>
                  <span className="ls-time">
                    {new Date(l.at).toLocaleTimeString('en-GB', { hour12: false })}
                  </span>
                  <span>{l.text}</span>
                </div>
              ))}
          </div>
        </aside>
      </div>

      {approvedReference && (
        <div className="ls-halt ok" data-testid="filed-banner">
          <Icon name="check" size={16} />
          <div>
            Approved by staff. Portal reference <strong>{approvedReference}</strong>. Confirmation slip queued to
            the client record.
          </div>
        </div>
      )}

      {phase === 'halted' && !approvedReference && (
        <div className="ls-halt">
          <div>
            <strong>HITL halt.</strong> The agent stopped before <em>Submit &amp; pay</em>. Compare the
            filled portal against the passport data, then approve.
          </div>
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={restart}>
            <Icon name="refresh" size={14} /> Re-run
          </button>
          <button className="btn primary sm" data-hitl="approve" onClick={approve}>
            <Icon name="check" size={14} /> Approve &amp; release payment
          </button>
        </div>
      )}

      {phase === 'done' && !approvedReference && (
        <div className="ls-halt ok">
          <Icon name="check" size={16} />
          <div>
            Approved by staff. Portal reference <strong>{reference}</strong>. Confirmation slip queued to
            the client record.
          </div>
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={restart}>
            Run again
          </button>
        </div>
      )}

      {phase === 'idle' && (
        <div className="ls-halt">
          <div>Browser instance ready on {jurisdiction.portalUrl.replace(/^https?:\/\//, '')}.</div>
          <span style={{ flex: 1 }} />
          <button className="btn primary sm" onClick={() => setPhase('typing')}>
            Start the run
          </button>
        </div>
      )}
    </div>
  );

  return body;
}
