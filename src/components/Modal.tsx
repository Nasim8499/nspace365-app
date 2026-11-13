import React, { useEffect } from 'react';
import Icon from './Icon';

export default function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  sub,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  sub?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={wide ? 'modal wide' : 'modal'} role="dialog" aria-modal="true">
        <div className="modalhead">
          <div className="col" style={{ flex: 1, minWidth: 0 }}>
            <div className="h2">{title}</div>
            {sub && <div className="sub" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modalbody scroll">{children}</div>
        {footer && <div className="modalfoot">{footer}</div>}
      </div>
    </div>
  );
}
