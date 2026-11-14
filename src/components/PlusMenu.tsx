import React, { useEffect, useRef } from 'react';
import Icon from './Icon';

export type PlusAction =
  | 'agent'
  | 'group'
  | 'contact'
  | 'artifact'
  | 'automation'
  | 'local'
  | 'video'
  | 'join'
  | 'credits';

const ITEMS: { key: PlusAction; label: string; icon: string; tint?: string }[] = [
  { key: 'agent', label: 'Create Agent', icon: 'sparkles', tint: '#007AFF' },
  { key: 'group', label: 'New Group', icon: 'users' },
  { key: 'contact', label: 'Add Contact', icon: 'user' },
  { key: 'artifact', label: 'Create Artifacts', icon: 'layers', tint: '#5E5CE6' },
  { key: 'automation', label: 'Create Automation', icon: 'bolt', tint: '#FF9500' },
  { key: 'local', label: 'Create Local Agent', icon: 'cpu' },
  { key: 'video', label: 'Start Video Meeting', icon: 'video', tint: '#34C759' },
  { key: 'join', label: 'Join Video Meeting', icon: 'video' },
  { key: 'credits', label: 'Credits Center', icon: 'key' },
];

export default function PlusMenu({
  open,
  onClose,
  onPick,
  align = 'left',
}: {
  open: boolean;
  onClose: () => void;
  onPick: (k: PlusAction) => void;
  align?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="plusmenu glass"
      ref={ref}
      role="menu"
      style={align === 'right' ? { right: 12, left: 'auto' } : { left: 12 }}
    >
      {ITEMS.map((it) => (
        <button
          key={it.key}
          className="plusitem"
          role="menuitem"
          onClick={() => {
            onPick(it.key);
            onClose();
          }}
        >
          <span
            className="plusico"
            style={{
              background: it.tint ? `${it.tint}1A` : 'rgba(29,29,31,.06)',
              color: it.tint || 'var(--ink)',
            }}
          >
            <Icon name={it.icon} size={15} />
          </span>
          <span className="pluslabel">{it.label}</span>
        </button>
      ))}
    </div>
  );
}
