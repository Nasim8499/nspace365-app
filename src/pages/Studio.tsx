import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import Markdown from '../lib/md';
import { copyText, downloadText, fmtDateTime, slug } from '../lib/util';

export default function Studio({ id }: { id: string }) {
  const { db, navigate, saveArtifact, updateArtifact, toast } = useApp();
  const existing = db.artifacts.find((a) => a.id === id);
  const [title, setTitle] = useState(existing?.title || 'Untitled document');
  const [body, setBody] = useState(
    existing?.body || '# New document\n\nStart writing, or paste agent output here.\n'
  );
  const [version, setVersion] = useState(existing?.version || 1);
  const [savedAt, setSavedAt] = useState<number | null>(existing?.updatedAt || null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setBody(existing.body);
    setVersion(existing.version);
    setSavedAt(existing.updatedAt);
  }, [id]);

  const words = useMemo(() => body.trim().split(/\s+/).filter(Boolean).length, [body]);

  const save = () => {
    if (existing) {
      updateArtifact(existing.id, { title, body });
      setVersion((v) => v + 1);
      toast('Saved — new version created');
    } else {
      const a = saveArtifact({ title, body, folder: 'Documents' });
      navigate(`/studio/${a.id}`);
      toast('Document created');
    }
    setDirty(false);
    setSavedAt(Date.now());
  };

  return (
    <div className="page">
      <div className="threadhead">
        <button className="iconbtn" onClick={() => navigate('/artifacts')} title="Back">
          <Icon name="back" size={18} />
        </button>
        <input
          className="input"
          style={{
            border: '1px solid transparent',
            background: 'transparent',
            fontWeight: 650,
            fontSize: 15,
            maxWidth: 420,
          }}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty(true);
          }}
        />
        <span className="badge blue">v{version}</span>
        {savedAt && <span className="hint">{fmtDateTime(savedAt)}</span>}
        <div style={{ flex: 1 }} />
        <button className="btn xs" onClick={async () => {
          await copyText(body);
          toast('Copied');
        }}>
          <Icon name="copy" size={13} /> Copy
        </button>
        <button className="btn xs" onClick={() => downloadText(`${slug(title)}.md`, body)}>
          <Icon name="download" size={13} /> .md
        </button>
        <button className="btn xs primary" onClick={save}>
          <Icon name="check" size={13} /> Save {dirty ? '•' : ''}
        </button>
      </div>

      <div className="studiosplit">
        <div className="studiopane">
          <div className="row" style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)' }}>
            <span className="badge">Editor</span>
            <span className="hint">{words} words</span>
          </div>
          <textarea
            className="studioedit scroll"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setDirty(true);
            }}
            spellCheck
          />
        </div>
        <div className="studiopane">
          <div className="row" style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)' }}>
            <span className="badge blue">Preview</span>
            <span className="hint">renders exactly as the chat card does</span>
          </div>
          <div className="studioprev scroll">
            <Markdown text={body} />
          </div>
        </div>
      </div>
    </div>
  );
}
