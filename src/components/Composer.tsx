import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import type { Attachment } from '../types';
import { bytes } from '../lib/util';

const ACCEPT =
  '.txt,.md,.markdown,.json,.csv,.tsv,.log,.js,.ts,.tsx,.jsx,.py,.html,.css,.sql,.yml,.yaml,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp';

export default function Composer({
  onSend,
  onStop,
  streaming,
  agentic,
  onToggleAgentic,
  modelLabel,
  onSkills,
}: {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  streaming: boolean;
  agentic: boolean;
  onToggleAgentic: () => void;
  modelLabel: string;
  onSkills?: () => void;
}) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [listening, setListening] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recog = useRef<any>(null);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const submit = () => {
    if (!text.trim() && !files.length) return;
    onSend(text, files);
    setText('');
    setFiles([]);
  };

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const next: Attachment[] = [];
    for (const f of Array.from(list).slice(0, 6)) {
      const isText =
        f.type.startsWith('text/') ||
        /\.(md|markdown|json|csv|tsv|log|js|ts|tsx|jsx|py|html|css|sql|yml|yaml)$/i.test(f.name);
      let body = '';
      if (isText) {
        body = await f.text().catch(() => '');
      }
      next.push({
        name: f.name,
        size: f.size,
        mime: f.type || 'application/octet-stream',
        text: body.slice(0, 20000),
      });
    }
    setFiles((f) => [...f, ...next].slice(0, 6));
  };

  const dictate = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Dictation needs Chrome, Edge or Safari with speech recognition enabled.');
      return;
    }
    if (listening) {
      recog.current?.stop();
      setListening(false);
      return;
    }
    const r = new SR();
    r.lang = navigator.language || 'en-US';
    r.continuous = true;
    r.interimResults = true;
    let base = text;
    r.onresult = (e: any) => {
      let final = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) base = `${base}${base && !base.endsWith(' ') ? ' ' : ''}${final}`;
      setText(base + interim);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    recog.current = r;
    setListening(true);
  };

  return (
    <div className="composer">
      <div className="composerbox">
        {files.length > 0 && (
          <div className="row wrap" style={{ marginBottom: 8 }}>
            {files.map((f, i) => (
              <span key={i} className="chip">
                <Icon name={f.text ? 'doc' : 'image'} size={13} />
                {f.name}
                <span style={{ color: 'var(--muted-2)' }}>{bytes(f.size)}</span>
                <button
                  className="iconbtn"
                  style={{ width: 18, height: 18 }}
                  onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}
                  aria-label="Remove"
                >
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={ta}
          value={text}
          placeholder={listening ? 'Listening…' : 'Ask anything, or describe the task…'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (!streaming) submit();
            }
          }}
          rows={1}
        />
        <div className="composerbar">
          <button
            className="iconbtn"
            title="Attach files"
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="clip" size={17} />
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            style={{ display: 'none' }}
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button className="iconbtn" title="Skills" onClick={onSkills}>
            <Icon name="wrench" size={16} />
          </button>
          <button className="iconbtn" title="Skills library" onClick={onSkills}>
            <Icon name="puzzle" size={16} />
          </button>
          <button
            className={`modechip${agentic ? '' : ''}`}
            onClick={onToggleAgentic}
            title="Agentic mode: plan, use memory, run tools"
            style={
              agentic
                ? { background: 'rgba(10,132,255,0.14)', color: 'var(--blue)' }
                : undefined
            }
          >
            <Icon name="sparkles" size={13} />
            Agentic
            <Icon name="chevronDown" size={12} />
          </button>
          <span
            className="hint"
            style={{ marginLeft: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title={modelLabel}
          >
            {modelLabel}
          </span>
          <div className="grow" />
          <button
            className={`iconbtn${listening ? ' on' : ''}`}
            title="Dictate"
            onClick={dictate}
          >
            <Icon name="mic" size={17} />
          </button>
          {streaming ? (
            <button className="send stop" onClick={onStop} title="Stop">
              <Icon name="close" size={16} />
            </button>
          ) : (
            <button
              className="send"
              onClick={submit}
              disabled={!text.trim() && !files.length}
              title="Send"
            >
              <Icon name="send" size={17} strokeWidth={2.1} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
