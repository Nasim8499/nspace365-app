import React, { useState } from 'react';
import type { Agent, Message } from '../types';
import { useApp } from '../lib/store';
import Markdown from '../lib/md';
import Icon from './Icon';
import { copyText, downloadText, relTime, slug } from '../lib/util';

export default function MessageCard({
  msg,
  agent,
  convId,
  onStudio,
}: {
  msg: Message;
  agent?: Agent;
  convId: string;
  onStudio: (artifactId: string) => void;
}) {
  const { db, rateMessage, saveArtifact, toast, navigate } = useApp();
  const [expanded, setExpanded] = useState(false);
  const artifact = msg.artifactId ? db.artifacts.find((a) => a.id === msg.artifactId) : undefined;
  const me = msg.role === 'user';

  if (me) {
    return (
      <div className="msgrow me">
        <div>
          <div className="bubble user">
            {msg.content && <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>}
            {msg.attachments?.length ? (
              <div className="row wrap" style={{ marginTop: 8 }}>
                {msg.attachments.map((a, i) => (
                  <span
                    key={i}
                    className="chip"
                    style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
                  >
                    <Icon name="doc" size={12} />
                    {a.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
            <span className="hint">{relTime(msg.createdAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  const long = msg.content.length > 1400;
  const body = long && !expanded ? `${msg.content.slice(0, 1400)}…` : msg.content;

  return (
    <div className="msgrow">
      <div
        className="avatar"
        style={{ background: agent?.color, marginTop: 2 }}
        title={agent?.name}
      >
        {agent?.initials || 'NS'}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="row" style={{ gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 650 }}>{agent?.name || 'NsPace Agent'}</span>
          {msg.model && <span className="badge">{msg.model}</span>}
          <span className="hint">{relTime(msg.createdAt)}</span>
        </div>

        <div className="bubble agent">
          {msg.content ? <Markdown text={body} /> : null}
          {msg.streaming && (
            <div className="typing" style={{ padding: msg.content ? '8px 0 0' : '2px 0' }}>
              <i />
              <i />
              <i />
            </div>
          )}
          {long && !expanded && (
            <button
              className="chip"
              style={{ marginTop: 8 }}
              onClick={() => setExpanded(true)}
            >
              Show more
            </button>
          )}
          {msg.error && (
            <div className="row" style={{ marginTop: 8 }}>
              <span className="badge red">Engine error</span>
              <button
                className="chip"
                onClick={() => toast('Fix the key in Settings → Models, then ask again.')}
              >
                How to fix
              </button>
            </div>
          )}
        </div>

        {artifact && (
          <div
            className="card"
            style={{ marginTop: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--grad-soft)',
                color: 'var(--blue)',
              }}
            >
              <Icon name="doc" size={17} />
            </span>
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 650 }}>{artifact.title}</div>
              <div className="hint">
                Markdown · v{artifact.version} · {Math.ceil(artifact.body.length / 900)} page
                {Math.ceil(artifact.body.length / 900) > 1 ? 's' : ''}
              </div>
            </div>
            <button className="btn sm primary" onClick={() => onStudio(artifact.id)}>
              Open Studio
            </button>
          </div>
        )}

        <div className={`msgfoot${msg.streaming ? '' : ''}`} style={{ opacity: 1 }}>
          <button
            className={`iconbtn${msg.feedback === 'up' ? ' on' : ''}`}
            style={{ width: 28, height: 28 }}
            onClick={() => rateMessage(convId, msg.id, 'up')}
            title="Good answer"
          >
            <Icon name="thumbUp" size={14} />
          </button>
          <button
            className={`iconbtn${msg.feedback === 'down' ? ' on' : ''}`}
            style={{ width: 28, height: 28 }}
            onClick={() => rateMessage(convId, msg.id, 'down')}
            title="Bad answer"
          >
            <Icon name="thumbDown" size={14} />
          </button>
          <button
            className="iconbtn"
            style={{ width: 28, height: 28 }}
            title="Copy"
            onClick={async () => {
              await copyText(msg.content);
              toast('Copied to clipboard');
            }}
          >
            <Icon name="copy" size={14} />
          </button>
          <button
            className="iconbtn"
            style={{ width: 28, height: 28 }}
            title="Download .md"
            onClick={() => downloadText(`${slug(agent?.name || 'nspace')}-${Date.now()}.md`, msg.content)}
          >
            <Icon name="download" size={14} />
          </button>
          <button
            className="iconbtn"
            style={{ width: 28, height: 28 }}
            title="Save as artifact"
            onClick={() => {
              const a = saveArtifact({
                title: `${agent?.name || 'NsPace'} — ${new Date().toLocaleDateString()}`,
                body: msg.content,
                folder: 'Documents',
                agentId: agent?.id,
                conversationId: convId,
              });
              toast('Saved to Artifacts');
              navigate('/artifacts');
              void a;
            }}
          >
            <Icon name="bookmark" size={14} />
          </button>
          <button
            className="iconbtn"
            style={{ width: 28, height: 28 }}
            title="Share link"
            onClick={async () => {
              const url = `${location.origin}${location.pathname}#/studio/${
                artifact?.id || 'saved'
              }`;
              await copyText(url);
              toast('Share link copied (opens on this device)');
            }}
          >
            <Icon name="share" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
