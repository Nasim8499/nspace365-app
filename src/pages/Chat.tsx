import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import Composer from '../components/Composer';
import MessageCard from '../components/MessageCard';
import Modal from '../components/Modal';
import PlusMenu, { type PlusAction } from '../components/PlusMenu';
import SkillsSheet from '../components/SkillsSheet';
import { tierOf } from '../lib/llm';
import { copyText, fmtDate, relTime } from '../lib/util';

export default function Chat({ convId }: { convId?: string }) {
  const {
    db,
    navigate,
    newConversation,
    deleteConversation,
    togglePin,
    sendMessage,
    stopStream,
    streamingIds,
    setSettings,
    toast,
    addAgent,
    deleteAgent,
  } = useApp();

  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<'All' | 'Pinned'>('All');
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [chatsOpen, setChatsOpen] = useState(true);
  const [picker, setPicker] = useState(false);
  const [invite, setInvite] = useState(false);
  const [workspace, setWorkspace] = useState(false);
  const [call, setCall] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [threadSearch, setThreadSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [newAgent, setNewAgent] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);

  const bottom = useRef<HTMLDivElement>(null);
  const scrollBox = useRef<HTMLDivElement>(null);

  const conv = db.conversations.find((c) => c.id === convId);
  const agent = db.agents.find((a) => a.id === conv?.agentId) || db.agents[0];
  const streaming = !!conv && streamingIds.includes(conv.id);

  const sorted = useMemo(
    () => [...db.conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [db.conversations]
  );
  const match = (t: string, s: string) => t.toLowerCase().includes(s.toLowerCase());
  const pinned = sorted.filter(
    (c) => c.pinned && (!query || match(c.title, query)) && (filter === 'All' || true)
  );
  const chats = sorted.filter(
    (c) =>
      !c.pinned &&
      (!query || match(c.title, query)) &&
      (filter === 'All' || (filter === 'Pinned' ? false : true))
  );

  useEffect(() => {
    const el = scrollBox.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [conv?.messages.length, conv?.messages[conv.messages.length - 1]?.content]);

  useEffect(() => {
    setMenuFor(null);
  }, [convId]);

  const visibleMessages = useMemo(() => {
    if (!conv) return [];
    if (!threadSearch.trim()) return conv.messages;
    return conv.messages.filter((m) => match(m.content, threadSearch));
  }, [conv, threadSearch]);

  const modelLabel = (() => {
    const m = agent?.model || db.settings.defaultModel;
    if (m === 'auto') return 'Auto router';
    return tierOf(m)?.label || 'Auto';
  })();

  const lastAssistant = [...(conv?.messages || [])].reverse().find((m) => m.role === 'assistant');
  const suggestions = [
    'Turn this into a one-page deliverable I can send',
    'Do a second pass and flag anything you are unsure about',
    'Schedule this to run weekly and save each run as an artifact',
  ];

  /* ---------------- voice call (real speech APIs) ---------------- */
  const [callState, setCallState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [callText, setCallText] = useState('');
  const recogRef = useRef<any>(null);
  const speakAfter = useRef(false);

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    const clean = text.replace(/[#*`>|]/g, ' ').replace(/\s+/g, ' ').slice(0, 420);
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = navigator.language || 'en-US';
    u.rate = 1.02;
    u.onstart = () => setCallState('speaking');
    u.onend = () => setCallState('idle');
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };

  useEffect(() => {
    if (!call) return;
    if (speakAfter.current && !streaming && lastAssistant?.content) {
      speakAfter.current = false;
      setCallState('thinking');
      speak(lastAssistant.content);
    }
  }, [streaming, lastAssistant?.content, call]);

  const listen = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast('Voice input needs Chrome, Edge or Safari');
      return;
    }
    const r = new SR();
    r.lang = navigator.language || 'en-US';
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let t = '';
      for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
      setCallText(t);
    };
    r.onend = () => {
      setCallText((t) => {
        if (t.trim() && conv) {
          speakAfter.current = true;
          setCallState('thinking');
          void sendMessage(conv.id, t.trim());
        } else setCallState('idle');
        return t;
      });
    };
    r.onerror = () => setCallState('idle');
    r.start();
    recogRef.current = r;
    setCallState('listening');
  };

  /* ---------------- render ---------------- */

  return (
    <div className="chatwrap">
      {/* ---------------- conversation list ---------------- */}
      <aside className={`listpane pane glass${conv ? ' hide' : ''}`}>
        <div className="listhead brandhead">
          <button className="avabtn" onClick={() => navigate('/me')} aria-label="Account">
            <span className="avatar" style={{ background: 'linear-gradient(135deg,#34C759,#0A84FF)' }}>
              {(db.settings.name || 'You')
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase() || 'Y'}
            </span>
            <span className="badgedot" />
          </button>
          <div className="brandmid" onClick={() => navigate('/chat')}>
            Ns<span>Pace</span>
            <i className="dot" />
          </div>
          <button
            className="plusgreen"
            onClick={() => setPlusOpen((v) => !v)}
            aria-label="Create"
            aria-expanded={plusOpen}
          >
            <Icon name="plus" size={19} strokeWidth={2.2} />
          </button>
          <PlusMenu
            open={plusOpen}
            onClose={() => setPlusOpen(false)}
            align="right"
            onPick={(k: PlusAction) => {
              if (k === 'agent') navigate('/agents');
              else if (k === 'artifact') navigate('/artifacts');
              else if (k === 'automation') navigate('/automations');
              else if (k === 'credits' || k === 'contact') navigate('/me');
              else if (k === 'video' || k === 'join') navigate('/studio');
              else if (k === 'local') {
                setNewAgent(true);
                toast('Local agents run entirely on this device');
              } else {
                setPicker(true);
                toast('Pick an agent to start a group chat');
              }
            }}
          />
        </div>

        <div className="listsearch">
          <div className="search" style={{ flex: 1 }}>
            <Icon name="search" size={14} />
            <input
              id="conv-search"
              className="input"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <button className="pill" onClick={() => setFilterOpen((v) => !v)} aria-label="Filter">
              <Icon name="list" size={13} />
              {filter}
              <Icon name="chevronDown" size={12} />
            </button>
            {filterOpen && (
              <div
                className="card"
                style={{ position: 'absolute', top: 38, right: 0, zIndex: 30, padding: 6, minWidth: 130 }}
              >
                {(['All', 'Pinned'] as const).map((f) => (
                  <button
                    key={f}
                    className="conv"
                    style={{ padding: '7px 9px' }}
                    onClick={() => {
                      setFilter(f);
                      setFilterOpen(false);
                    }}
                  >
                    <span style={{ fontSize: 13.5 }}>{f}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="convlist scroll">
          {pinned.length > 0 && (
            <>
              <button
                className={`section${pinnedOpen ? '' : ' closed'}`}
                onClick={() => setPinnedOpen((v) => !v)}
              >
                <Icon name="chevronDown" size={12} />
                Pinned · {pinned.length}
              </button>
              {pinnedOpen &&
                pinned.map((c) => (
                  <ConvRow
                    key={c.id}
                    conv={c}
                    active={c.id === convId}
                    agent={db.agents.find((a) => a.id === c.agentId)}
                    onOpen={() => navigate(`/chat/${c.id}`)}
                    menuOpen={menuFor === c.id}
                    onMenu={() => setMenuFor(menuFor === c.id ? null : c.id)}
                    onPin={() => {
                      togglePin(c.id);
                      setMenuFor(null);
                    }}
                    onDelete={() => {
                      deleteConversation(c.id);
                      setMenuFor(null);
                    }}
                  />
                ))}
            </>
          )}

          <button
            className={`section${chatsOpen ? '' : ' closed'}`}
            onClick={() => setChatsOpen((v) => !v)}
          >
            <Icon name="chevronDown" size={12} />
            Chats · {chats.length}
          </button>
          {chatsOpen &&
            chats.map((c) => (
              <ConvRow
                key={c.id}
                conv={c}
                active={c.id === convId}
                agent={db.agents.find((a) => a.id === c.agentId)}
                onOpen={() => navigate(`/chat/${c.id}`)}
                menuOpen={menuFor === c.id}
                onMenu={() => setMenuFor(menuFor === c.id ? null : c.id)}
                onPin={() => {
                  togglePin(c.id);
                  setMenuFor(null);
                }}
                onDelete={() => {
                  deleteConversation(c.id);
                  setMenuFor(null);
                }}
              />
            ))}

          {!pinned.length && !chats.length && (
            <div className="empty" style={{ padding: '40px 16px' }}>
              <div className="big">
                <Icon name="chat" size={24} />
              </div>
              <div style={{ fontWeight: 650, color: 'var(--ink)' }}>No chats yet</div>
              <div className="hint">Start one with any agent. Everything stays on this device.</div>
              <button className="btn sm primary" onClick={() => setPicker(true)}>
                <Icon name="plus" size={14} /> New chat
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ---------------- thread ---------------- */}
      <section className={`threadpane pane glass${conv ? ' show' : ' hide'}`}>
        {!conv ? (
          <div className="empty">
            <div className="big">
              <Icon name="chat" size={26} />
            </div>
            <div className="h1" style={{ fontSize: 22 }}>
              Your AI team is ready
            </div>
            <div className="hint" style={{ maxWidth: 340 }}>
              Pick an agent, describe the outcome, and NsPace plans, runs and saves the deliverable.
            </div>
            <button className="btn primary" onClick={() => setPicker(true)}>
              <Icon name="plus" size={15} /> Start a chat
            </button>
          </div>
        ) : (
          <>
            <header className="threadhead">
              <button
                className="iconbtn backbtn"
                onClick={() => navigate('/chat')}
                aria-label="Back"
              >
                <Icon name="back" size={18} />
              </button>
              <button
                className="row"
                style={{ gap: 9, minWidth: 0 }}
                onClick={() => setWorkspace(true)}
              >
                <span className="avatar ring" style={{ background: agent?.color }}>
                  {agent?.initials}
                </span>
                <span className="col" style={{ minWidth: 0, textAlign: 'left' }}>
                  <span className="name" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.title || agent?.name}
                  </span>
                  <span className="meta">{agent?.name} · {streaming ? 'working…' : 'ready'}</span>
                </span>
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn xs" onClick={() => setInvite(true)}>
                Invite
              </button>
              <button className="btn xs" onClick={() => setWorkspace(true)}>
                <Icon name="bot" size={13} /> Workspace
              </button>
              <button
                className="iconbtn"
                title="Voice call"
                onClick={() => {
                  setCall(true);
                  setCallState('idle');
                }}
              >
                <Icon name="phone" size={17} />
              </button>
              <button
                className={`iconbtn${searchOpen ? ' on' : ''}`}
                title="Search in chat"
                onClick={() => setSearchOpen((v) => !v)}
              >
                <Icon name="search" size={17} />
              </button>
              <button className="iconbtn" title="More" onClick={() => setWorkspace(true)}>
                <Icon name="more" size={17} />
              </button>
            </header>

            {searchOpen && (
              <div style={{ padding: '8px 14px 0' }}>
                <div className="search">
                  <Icon name="search" size={14} />
                  <input
                    className="input"
                    placeholder="Search this conversation"
                    value={threadSearch}
                    onChange={(e) => setThreadSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="thread scroll" ref={scrollBox}>
              <div className="friendsline">
                <span className="fl-date">
                  {conv.createdAt ? fmtDate(conv.createdAt) : 'Today'}
                </span>
                <span className="fl-text">You are now friends and can start chatting!</span>
              </div>
              {visibleMessages.length === 0 && (
                <div className="empty" style={{ paddingTop: 30 }}>
                  <div className="big">
                    <Icon name="sparkles" size={24} />
                  </div>
                  <div className="h1" style={{ fontSize: 21 }}>
                    {agent?.name}
                  </div>
                  <div className="hint" style={{ maxWidth: 420 }}>
                    {agent?.tagline}
                  </div>
                </div>
              )}
              {visibleMessages.map((m) => (
                <MessageCard
                  key={m.id}
                  msg={m}
                  agent={m.role === 'assistant' ? agent : undefined}
                  convId={conv.id}
                  onStudio={(id) => navigate(`/studio/${id}`)}
                />
              ))}

              {!streaming && lastAssistant && visibleMessages.length > 0 && (
                <div className="suggests" style={{ padding: '0 0 8px 46px' }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      className="suggest"
                      onClick={() => void sendMessage(conv.id, s)}
                    >
                      <span className="plus">+</span>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div ref={bottom} />
            </div>

            <Composer
              onSend={(text, files) => void sendMessage(conv.id, text, files)}
              onStop={() => stopStream(conv.id)}
              streaming={streaming}
              agentic={db.settings.agenticMode}
              onToggleAgentic={() =>
                setSettings({ agenticMode: !db.settings.agenticMode })
              }
              modelLabel={modelLabel}
              onSkills={() => setSkillsOpen(true)}
            />
            <SkillsSheet open={skillsOpen} onClose={() => setSkillsOpen(false)} />
          </>
        )}
      </section>

      {/* ---------------- modals ---------------- */}

      {picker && (
        <Modal
          title="Start a chat"
          sub="Pick an agent, or create your own"
          onClose={() => setPicker(false)}
          footer={
            <button className="btn" onClick={() => setNewAgent(true)}>
              <Icon name="plus" size={14} /> New agent
            </button>
          }
        >
          <div className="col" style={{ gap: 6 }}>
            {db.agents.map((a) => (
              <button
                key={a.id}
                className="conv"
                onClick={() => {
                  setPicker(false);
                  newConversation(a.id);
                }}
              >
                <span className="avatar" style={{ background: a.color }}>
                  {a.initials}
                </span>
                <span className="body">
                  <span className="name">{a.name}</span>
                  <span className="prev">{a.tagline}</span>
                </span>
                <Icon name="arrowRight" size={16} />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {invite && conv && (
        <Modal
          title="Invite to this chat"
          sub="Anyone with the link can open this conversation on this device"
          onClose={() => setInvite(false)}
          footer={
            <button className="btn primary" onClick={() => setInvite(false)}>
              Done
            </button>
          }
        >
          <label className="label">Share link</label>
          <div className="row">
            <input
              className="input"
              readOnly
              value={`${location.origin}${location.pathname}#/chat/${conv.id}`}
            />
            <button
              className="btn"
              onClick={async () => {
                await copyText(`${location.origin}${location.pathname}#/chat/${conv.id}`);
                toast('Link copied');
              }}
            >
              Copy
            </button>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            NsPace is local-first: chats live on this device. Collaborators need to be on the same
            device or a shared deployment of this build.
          </p>
        </Modal>
      )}

      {workspace && conv && (
        <Modal
          title="Agent workspace"
          sub={agent?.name}
          onClose={() => setWorkspace(false)}
          footer={
            <>
              <button
                className="btn danger"
                onClick={() => {
                  if (agent?.builtin) {
                    toast('Built-in agents cannot be deleted');
                    return;
                  }
                  deleteAgent(agent!.id);
                  setWorkspace(false);
                  toast('Agent deleted');
                }}
              >
                Delete agent
              </button>
              <button className="btn primary" onClick={() => setWorkspace(false)}>
                Close
              </button>
            </>
          }
        >
          <label className="label">System prompt</label>
          <textarea
            className="textarea"
            style={{ minHeight: 120 }}
            readOnly
            defaultValue={agent?.system}
          />
          <div className="row" style={{ marginTop: 12, gap: 16 }}>
            <div>
              <div className="hint">Model</div>
              <div style={{ fontWeight: 650 }}>{modelLabel}</div>
            </div>
            <div>
              <div className="hint">Memory</div>
              <div style={{ fontWeight: 650 }}>{db.memories.length} items</div>
            </div>
            <div>
              <div className="hint">Turns</div>
              <div style={{ fontWeight: 650 }}>{conv.messages.length}</div>
            </div>
            <div>
              <div className="hint">Created</div>
              <div style={{ fontWeight: 650 }}>{fmtDate(conv.createdAt)}</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button
              className="btn sm"
              onClick={() => {
                togglePin(conv.id);
                toast('Pin toggled');
              }}
            >
              <Icon name="bookmark" size={13} /> {conv.pinned ? 'Unpin' : 'Pin'} chat
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                deleteConversation(conv.id);
                setWorkspace(false);
              }}
            >
              <Icon name="trash" size={13} /> Delete chat
            </button>
          </div>
        </Modal>
      )}

      {newAgent && (
        <NewAgent
          onClose={() => setNewAgent(false)}
          onCreate={(a) => {
            const created = addAgent(a);
            setNewAgent(false);
            setPicker(false);
            newConversation(created.id);
          }}
        />
      )}

      {call && (
        <Modal
          title="Voice call"
          sub={agent?.name}
          onClose={() => {
            recogRef.current?.stop?.();
            speechSynthesis.cancel();
            setCall(false);
            setCallState('idle');
            setCallText('');
          }}
          footer={
            <button
              className="btn danger block"
              onClick={() => {
                speechSynthesis.cancel();
                recogRef.current?.stop?.();
                setCall(false);
                setCallState('idle');
              }}
            >
              End call
            </button>
          }
        >
          <div style={{ display: 'grid', placeItems: 'center', gap: 14, padding: '10px 0 4px' }}>
            <div
              className="avatar"
              style={{
                background: agent?.color,
                width: 84,
                height: 84,
                borderRadius: 28,
                fontSize: 30,
                boxShadow: '0 18px 50px rgba(10,132,255,0.3)',
              }}
            >
              {agent?.initials}
            </div>
            <div className="h2">{agent?.name}</div>
            <div className="hint">
              {callState === 'idle' && 'Tap to speak. The answer is read back to you.'}
              {callState === 'listening' && 'Listening…'}
              {callState === 'thinking' && 'Thinking…'}
              {callState === 'speaking' && 'Speaking…'}
            </div>
            {callText && (
              <div className="bubble agent" style={{ maxWidth: '100%' }}>
                {callText}
              </div>
            )}
            <button
              className="send"
              style={{ width: 56, height: 56 }}
              onClick={() => (callState === 'listening' ? recogRef.current?.stop() : listen())}
              disabled={callState === 'thinking' || callState === 'speaking'}
            >
              <Icon name="mic" size={22} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ConvRow({
  conv,
  agent,
  active,
  onOpen,
  menuOpen,
  onMenu,
  onPin,
  onDelete,
}: {
  conv: { id: string; title: string; updatedAt: number; messages: { content: string }[]; pinned?: boolean };
  agent?: { name: string; initials: string; color: string };
  active: boolean;
  onOpen: () => void;
  menuOpen: boolean;
  onMenu: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const last = [...conv.messages].reverse().find((m) => m.content);
  return (
    <div style={{ position: 'relative' }}>
      <button className={`conv${active ? ' on' : ''}`} onClick={onOpen}>
        <span className="avatar" style={{ background: agent?.color }}>
          {agent?.initials || 'NS'}
        </span>
        <span className="body">
          <span className="top">
            <span className="name">{conv.title}</span>
            <span className="date">{relTime(conv.updatedAt)}</span>
          </span>
          <span className="prev">{last?.content?.replace(/[#*`>|]/g, ' ').slice(0, 90) || 'No messages yet'}</span>
        </span>
      </button>
      <button
        className="iconbtn"
        style={{ position: 'absolute', right: 6, top: 8, width: 26, height: 26 }}
        onClick={(e) => {
          e.stopPropagation();
          onMenu();
        }}
        aria-label="Chat options"
      >
        <Icon name="more" size={14} />
      </button>
      {menuOpen && (
        <div
          className="card"
          style={{ position: 'absolute', right: 6, top: 36, zIndex: 40, padding: 5, width: 150 }}
        >
          <button className="conv" style={{ padding: '7px 9px' }} onClick={onPin}>
            <Icon name="bookmark" size={14} /> {conv.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            className="conv"
            style={{ padding: '7px 9px', color: 'var(--red)' }}
            onClick={onDelete}
          >
            <Icon name="trash" size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function NewAgent({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (a: {
    name: string;
    category: string;
    tagline: string;
    system: string;
    builtin: boolean;
  }) => void;
}) {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState('Life');
  const [system, setSystem] = useState('');
  return (
    <Modal
      title="Create an agent"
      sub="A name, a job, and the instructions it follows"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!name.trim()}
            onClick={() =>
              onCreate({
                name: name.trim(),
                tagline: tagline.trim() || 'A custom NsPace agent.',
                category,
                system:
                  system.trim() ||
                  `You are ${name.trim()}, a specialist agent inside NsPace. Be concrete, structured and honest about uncertainty.`,
                builtin: false,
              })
            }
          >
            Create agent
          </button>
        </>
      }
    >
      <label className="label">Name</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tender Writer" />
      <div style={{ height: 12 }} />
      <label className="label">What it does</label>
      <input
        className="input"
        value={tagline}
        onChange={(e) => setTagline(e.target.value)}
        placeholder="One line, shown on the card"
      />
      <div style={{ height: 12 }} />
      <label className="label">Category</label>
      <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
        {['Life', 'Content Creation', 'Engineering', 'Finance', 'Marketing', 'Recruitment', 'Visa & Docs', 'Legal', 'Design', 'Education', 'Data Analysis', 'Customer Support'].map(
          (c) => (
            <option key={c}>{c}</option>
          )
        )}
      </select>
      <div style={{ height: 12 }} />
      <label className="label">Instructions (system prompt)</label>
      <textarea
        className="textarea"
        value={system}
        onChange={(e) => setSystem(e.target.value)}
        placeholder="How should it behave? What must it never do?"
      />
    </Modal>
  );
}
