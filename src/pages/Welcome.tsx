import React, { useEffect, useRef, useState } from 'react';
import { Monogram, Wordmark } from '../components/Logo';
import Icon from '../components/Icon';

const LINES = [
  'Visa cases, documents and agent progress in one workspace.',
  'Applicants see their own file. The agency sees everything.',
  'Built for real embassy work, not demos.',
];

const TILES = [
  { icon: 'chat', label: 'Agent chat', value: 'streaming live', tone: 'blue' },
  { icon: 'passport', label: 'Visa Automate', value: 'case drafted', tone: 'indigo' },
  { icon: 'clock', label: 'Automations', value: 'next run 09:00', tone: 'green' },
];

export default function Welcome({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0); // 0 boot · 1 brand · 2 tiles · 3 ready
  const [line, setLine] = useState(0);
  const [typed, setTyped] = useState('');
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t: number[] = [];
    if (reduce) {
      setPhase(3);
      t.push(window.setTimeout(finish, 400));
      return () => t.forEach(clearTimeout);
    }
    t.push(window.setTimeout(() => setPhase(1), 260));
    t.push(window.setTimeout(() => setPhase(2), 1150));
    t.push(window.setTimeout(() => setPhase(3), 2050));
    t.push(window.setTimeout(finish, 4300));
    return () => t.forEach(clearTimeout);
  }, []);

  // typewriter for the rotating promise line
  useEffect(() => {
    if (phase < 2) return;
    const text = LINES[line % LINES.length];
    let i = 0;
    setTyped('');
    const id = window.setInterval(() => {
      i += 1;
      setTyped(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        window.setTimeout(() => setLine((n) => n + 1), 2100);
      }
    }, 26);
    return () => clearInterval(id);
  }, [line, phase]);

  return (
    <div className="welc">
      <div className="welc-aurora" aria-hidden>
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
        <span className="blob b4" />
        <span className="grain" />
      </div>

      <div className="welc-glow" aria-hidden>
        <span className="ring r1" />
        <span className="ring r2" />
      </div>

      <div className="welc-inner">
        <div className={`welc-mark${phase >= 1 ? ' on' : ''}`}>
          <Monogram size={78} />
        </div>

        <div className={`welc-brand${phase >= 1 ? ' on' : ''}`}>
          <Wordmark size={40} />
        </div>

        <div className={`welc-type${phase >= 2 ? ' on' : ''}`}>
          <span>{typed}</span>
          <i className="caret" />
        </div>

        <div className={`welc-tiles${phase >= 2 ? ' on' : ''}`}>
          {TILES.map((t, i) => (
            <div key={t.label} className={`welc-tile ${t.tone}`} style={{ animationDelay: `${i * 110}ms` }}>
              <span className="welc-tile-ic"><Icon name={t.icon} size={15} /></span>
              <div>
                <div className="welc-tile-label">{t.label}</div>
                <div className="welc-tile-value">{t.value}</div>
              </div>
              <span className="welc-tile-dot" />
            </div>
          ))}
        </div>

        <div className={`welc-cta${phase >= 3 ? ' on' : ''}`}>
          <button className="btn dark welc-go" onClick={finish} data-testid="welcome-enter">
            <Icon name="arrowRight" size={16} /> Enter workspace
            <span className="welc-shine" />
          </button>
          <button className="welc-skip" onClick={finish}>Skip intro</button>
        </div>

        <div className={`welc-bar${phase >= 1 ? ' on' : ''}`}>
          <span />
        </div>
      </div>
    </div>
  );
}
