import React, { useMemo, useState } from 'react';
import Icon from './Icon';
import { SKILLS } from '../lib/skills';

/**
 * Skills picker — the built-in capability list, matching the reference app's
 * "Skills" overlay: count line, Browse all, search, and one row per skill.
 */
export default function SkillsSheet({
  open,
  onClose,
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  onUse?: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [browse, setBrowse] = useState(false);

  const list = useMemo(
    () =>
      SKILLS.filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q.toLowerCase()) ||
          s.summary.toLowerCase().includes(q.toLowerCase())
      ),
    [q]
  );
  const shown = browse ? list : list.slice(0, 5);

  if (!open) return null;

  return (
    <div className="sheetwrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="skillssheet glass" role="dialog" aria-label="Skills">
        <div className="skillshead">
          <div className="col" style={{ flex: 1, minWidth: 0 }}>
            <div className="h2" style={{ fontSize: 15 }}>
              Skills
            </div>
            <div className="hint">
              {SKILLS.length} selected · {SKILLS.length * 2} total
            </div>
          </div>
          <button className="btn xs" onClick={() => setBrowse((v) => !v)}>
            {browse ? 'Show less' : 'Browse all'}
            <Icon name={browse ? 'chevronUp' : 'chevronRight'} size={12} />
          </button>
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </div>

        <div style={{ padding: '0 12px 10px' }}>
          <div className="search">
            <Icon name="search" size={14} />
            <input
              className="input"
              placeholder="Search skills"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="skillslist scroll">
          {shown.map((s) => (
            <button
              key={s.id}
              className="skillrow"
              onClick={() => {
                onUse?.(s.id);
                onClose();
              }}
            >
              <span className="skillico">
                <Icon name={s.icon} size={15} />
              </span>
              <span className="col" style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <span className="skillname">{s.name}</span>
                <span className="skilldesc">{s.summary}</span>
              </span>
              <span className="builtin">Built-in</span>
            </button>
          ))}
          {!shown.length && <div className="hint" style={{ padding: 14 }}>No skill matches “{q}”.</div>}
        </div>
      </div>
    </div>
  );
}
