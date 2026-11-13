import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { byCode } from './knowledge';
import { emptyApplicant, token } from './dossier';
import type { VisaCase } from './dossier';
import type {
  Agent,
  Artifact,
  Attachment,
  Automation,
  Conversation,
  DB,
  MemoryItem,
  Message,
  ModelKey,
  Settings,
} from '../types';
import { ADMIN_EMAIL, ADMIN_NAME, GOOGLE_CLIENT_ID, makeDefaultDB, seedAgents } from './seed';
import { streamChat } from './llm';
import type { ChatMessage } from './llm';
import { clip, nextRunFor, uid } from './util';

const KEY = 'nspace.db.v3';

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return makeDefaultDB();
    const parsed = JSON.parse(raw) as DB;
    if (!parsed.settings || !Array.isArray(parsed.agents)) return makeDefaultDB();
    // the real Google client id ships with the build; fill it in for older local data
    if (!parsed.settings.googleClientId) parsed.settings.googleClientId = GOOGLE_CLIENT_ID;
    parsed.users = parsed.users || [];
    if (!parsed.users.some((u) => u.email.toLowerCase() === ADMIN_EMAIL)) {
      parsed.users.unshift({ email: ADMIN_EMAIL, name: ADMIN_NAME, role: 'admin', createdAt: Date.now() });
    }
    // forward-compatible defaults
    parsed.agents = parsed.agents.length ? parsed.agents : seedAgents;
    parsed.artifacts = parsed.artifacts || [];
    parsed.memories = parsed.memories || [];
    parsed.automations = parsed.automations || [];
    parsed.conversations = parsed.conversations || [];
    parsed.visaCases = parsed.visaCases || [];
    // forward-add any built-in agent added in a later release, without duplicating
    const have = new Set(parsed.agents.map((a) => a.name));
    seedAgents.forEach((a) => {
      if (!have.has(a.name)) parsed.agents.push(a);
    });
    return parsed;
  } catch {
    return makeDefaultDB();
  }
}

export interface Toast {
  id: string;
  text: string;
}

interface Ctx {
  db: DB;
  addVisaCase: (country: string) => VisaCase;
  visibleCases: VisaCase[];
  canSeeCase: (c: VisaCase) => boolean;
  updateVisaCase: (id: string, patch: Partial<VisaCase>) => void;
  deleteVisaCase: (id: string) => void;
  route: string;
  navigate: (to: string) => void;
  toasts: Toast[];
  toast: (text: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  signIn: (name: string, email: string, role?: 'applicant' | 'admin', pw?: string) => boolean;
  signOut: () => void;
  newConversation: (agentId?: string) => string;
  deleteConversation: (id: string) => void;
  togglePin: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  sendMessage: (convId: string, text: string, attachments?: Attachment[]) => Promise<string | undefined>;
  stopStream: (convId: string) => void;
  streamingIds: string[];
  rateMessage: (convId: string, msgId: string, v: 'up' | 'down') => void;
  addAgent: (a: Omit<Agent, 'id' | 'initials' | 'color'>) => Agent;
  deleteAgent: (id: string) => void;
  saveArtifact: (a: Partial<Artifact> & { title: string; body: string }) => Artifact;
  updateArtifact: (id: string, patch: Partial<Artifact>) => void;
  deleteArtifact: (id: string) => void;
  addMemory: (text: string, source?: MemoryItem['source']) => void;
  deleteMemory: (id: string) => void;
  addAutomation: (a: Omit<Automation, 'id' | 'runs' | 'nextRun' | 'lastRun'>) => void;
  updateAutomation: (id: string, patch: Partial<Automation>) => void;
  deleteAutomation: (id: string) => void;
  runAutomation: (id: string) => Promise<void>;
  runLog: string[];
}

const AppCtx = createContext<Ctx | null>(null);

function parseHash(): string {
  const h = location.hash.replace(/^#/, '');
  if (h) return h;
  // clean URLs such as /privacy work too (Vercel rewrites them to index.html)
  const p = location.pathname.replace(/\/+$/, '');
  if (p && p !== '' && p !== '/index.html') return p;
  return '/chat';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [db, setDB] = useState<DB>(load);
  const [route, setRoute] = useState<string>(parseHash);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [streamingIds, setStreamingIds] = useState<string[]>([]);
  const [runLog, setRunLog] = useState<string[]>([]);
  const dbRef = useRef(db);
  const abortRef = useRef<Record<string, AbortController>>({});
  const schedulerStarted = useRef(false);

  dbRef.current = db;

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(db));
  }, [db]);

  useEffect(() => {
    document.documentElement.dataset.theme = db.settings.theme;
  }, [db.settings.theme]);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    if (!location.hash) location.hash = '#/chat';
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/chat');
        setTimeout(() => {
          const el = document.getElementById('conv-search') as HTMLInputElement | null;
          el?.focus();
        }, 60);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navigate = useCallback((to: string) => {
    location.hash = `#${to}`;
    setRoute(to);
  }, []);

  const toast = useCallback((text: string) => {
    const id = uid('t_');
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setDB((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const signIn = useCallback((name: string, email: string, role?: 'applicant' | 'admin', pw?: string) => {
    let ok = true;
    setDB((d) => {
      const existing = d.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      // a stored password must match before this account can be entered again
      if (existing?.pw && pw !== undefined && existing.pw !== pw) {
        ok = false;
        return d;
      }
      const nextRole = role || existing?.role || 'applicant';
      const users = existing
        ? d.users.map((u) =>
            u.email === existing.email
              ? { ...u, name: name || u.name, role: nextRole, pw: pw || u.pw }
              : u
          )
        : [...d.users, { email, name, role: nextRole, createdAt: Date.now(), pw }];
      return {
        ...d,
        users,
        settings: {
          ...d.settings,
          signedIn: true,
          role: nextRole,
          name,
          email: email || 'local',
          handle: (email.split('@')[0] || name || 'you').toLowerCase().replace(/[^a-z0-9._-]/g, ''),
        },
      };
    });
    return ok;
  }, []);

  const signOut = useCallback(() => {
    setDB((d) => ({ ...d, settings: { ...d.settings, signedIn: false } }));
    location.hash = '#/chat';
  }, []);

  const newConversation = useCallback((agentId?: string) => {
    const d = dbRef.current;
    const agent = agentId ? d.agents.find((a) => a.id === agentId) : d.agents[0];
    const id = uid('cv_');
    const conv: Conversation = {
      id,
      title: 'New chat',
      agentId: agent?.id || d.agents[0].id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setDB((prev) => ({ ...prev, conversations: [conv, ...prev.conversations] }));
    navigate(`/chat/${id}`);
    return id;
  }, [navigate]);

  const patchConversation = useCallback((id: string, fn: (c: Conversation) => Conversation) => {
    setDB((d) => ({
      ...d,
      conversations: d.conversations.map((c) => (c.id === id ? fn(c) : c)),
    }));
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setDB((d) => ({ ...d, conversations: d.conversations.filter((c) => c.id !== id) }));
      navigate('/chat');
      toast('Chat deleted');
    },
    [navigate, toast]
  );

  const togglePin = useCallback((id: string) => {
    setDB((d) => ({
      ...d,
      conversations: d.conversations.map((c) =>
        c.id === id ? { ...c, pinned: !c.pinned } : c
      ),
    }));
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    setDB((d) => ({
      ...d,
      conversations: d.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    }));
  }, []);

  const rateMessage = useCallback((convId: string, msgId: string, v: 'up' | 'down') => {
    setDB((d) => ({
      ...d,
      conversations: d.conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId ? { ...m, feedback: m.feedback === v ? null : v } : m
              ),
            }
          : c
      ),
    }));
  }, []);

  const addAgent = useCallback((a: Omit<Agent, 'id' | 'initials' | 'color'>) => {
    const agent: Agent = {
      ...a,
      id: uid('ag_'),
      initials: (a.name || 'A')
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase(),
      color: 'linear-gradient(135deg,#0A84FF,#5E5CE6)',
    };
    setDB((d) => ({ ...d, agents: [agent, ...d.agents] }));
    return agent;
  }, []);

  const deleteAgent = useCallback((id: string) => {
    setDB((d) => ({ ...d, agents: d.agents.filter((a) => a.id !== id) }));
  }, []);

  const saveArtifact = useCallback(
    (a: Partial<Artifact> & { title: string; body: string }) => {
      const now = Date.now();
      const art: Artifact = {
        id: uid('ar_'),
        kind: a.kind || 'markdown',
        title: a.title,
        body: a.body,
        version: a.version || 1,
        createdAt: now,
        updatedAt: now,
        folder: a.folder || 'Documents',
        agentId: a.agentId,
        conversationId: a.conversationId,
        tags: a.tags || [],
        saved: a.saved,
      };
      setDB((d) => ({ ...d, artifacts: [art, ...d.artifacts] }));
      return art;
    },
    []
  );

  const updateArtifact = useCallback((id: string, patch: Partial<Artifact>) => {
    setDB((d) => ({
      ...d,
      artifacts: d.artifacts.map((a) =>
        a.id === id
          ? {
              ...a,
              ...patch,
              version: patch.body !== undefined && patch.body !== a.body ? a.version + 1 : a.version,
              updatedAt: Date.now(),
            }
          : a
      ),
    }));
  }, []);

  const deleteArtifact = useCallback((id: string) => {
    setDB((d) => ({ ...d, artifacts: d.artifacts.filter((a) => a.id !== id) }));
  }, []);

  const addMemory = useCallback((text: string, source: MemoryItem['source'] = 'manual') => {
    const clean = text.trim();
    if (!clean) return;
    setDB((d) => {
      if (d.memories.some((m) => m.text.toLowerCase() === clean.toLowerCase())) return d;
      return {
        ...d,
        memories: [
          { id: uid('m_'), text: clean, createdAt: Date.now(), source },
          ...d.memories,
        ],
      };
    });
  }, []);

  const deleteMemory = useCallback((id: string) => {
    setDB((d) => ({ ...d, memories: d.memories.filter((m) => m.id !== id) }));
  }, []);

  /* ------------------------- chat engine ------------------------- */

  const sendMessage = useCallback(
    async (convId: string, text: string, attachments?: Attachment[]): Promise<string | undefined> => {
      const d = dbRef.current;
      const conv = d.conversations.find((c) => c.id === convId);
      if (!conv) return;
      const agent = d.agents.find((a) => a.id === conv.agentId) || d.agents[0];
      const trimmed = text.trim();
      if (!trimmed && !(attachments && attachments.length)) return undefined;
      let savedArtifactId: string | undefined;

      const userMsg: Message = {
        id: uid('ms_'),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
        attachments,
      };
      const asstId = uid('ms_');
      const asstMsg: Message = {
        id: asstId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        streaming: true,
      };

      const firstUser = !conv.messages.some((m) => m.role === 'user');
      const nextTitle = firstUser ? clip(trimmed, 54) || conv.title : conv.title;
      patchConversation(convId, (c) => ({
        ...c,
        title: firstUser ? clip(trimmed, 54) || c.title : c.title,
        updatedAt: Date.now(),
        messages: [...c.messages, userMsg, asstMsg],
      }));

      const controller = new AbortController();
      abortRef.current[convId] = controller;
      setStreamingIds((s) => [...s, convId]);

      const patchAssistant = (fn: (m: Message) => Message) =>
        setDB((prev) => ({
          ...prev,
          conversations: prev.conversations.map((c) =>
            c.id === convId
              ? { ...c, messages: c.messages.map((m) => (m.id === asstId ? fn(m) : m)) }
              : c
          ),
        }));

      // memory + system prompt
      const memoryBlock =
        d.settings.preferMemory && d.memories.length
          ? `\n\nKnown context about the user (use it, do not recite it):\n${d.memories
              .slice(0, 12)
              .map((m) => `- ${m.text}`)
              .join('\n')}`
          : '';
      const sys = `${agent.system}

You are ${agent.name} inside NsPace, a personal AI workspace. Answer in the user's language. Prefer concrete, structured, skimmable output. Use markdown (headings, short bullets, tables where useful). Never invent facts, links, numbers or citations. If something is uncertain, say so plainly. Today is ${new Date().toDateString()}.${memoryBlock}`;

      const history: ChatMessage[] = [
        { role: 'system', content: sys },
        ...conv.messages
          .filter((m) => !m.streaming && m.content)
          .slice(-18)
          .map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
        {
          role: 'user',
          content:
            trimmed +
            (attachments && attachments.length
              ? `\n\nAttached files:\n${attachments
                  .map((a) => `--- ${a.name} ---\n${(a.text || '(binary file)').slice(0, 4000)}`)
                  .join('\n')}`
              : ''),
        },
      ];

      let buf = '';
      let timer: number | null = null;
      const flush = () => {
        if (!buf) return;
        const add = buf;
        buf = '';
        patchAssistant((m) => ({ ...m, content: m.content + add }));
      };
      const onToken = (chunk: string) => {
        buf += chunk;
        if (timer === null) {
          timer = window.setTimeout(() => {
            timer = null;
            flush();
          }, 40);
        }
      };

      try {
        const res = await streamChat({
          messages: history,
          model: agent.model || d.settings.defaultModel,
          settings: d.settings,
          onToken,
          signal: controller.signal,
        });
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        flush();

        // persist the finished message, auto-saving long answers as artifacts
        const finished = dbRef.current.conversations
          .find((c) => c.id === convId)
          ?.messages.find((m) => m.id === asstId);
        const content = finished?.content || '';
        let artifactId: string | undefined;
        if (content.length > 600) {
          const art = saveArtifact({
            title: `${clip(nextTitle, 46)} — ${new Date().toLocaleDateString()}`,
            body: content,
            folder: 'Documents',
            agentId: agent.id,
            conversationId: convId,
          });
          artifactId = art.id;
          savedArtifactId = art.id;
        }
        patchAssistant((m) => ({
          ...m,
          streaming: false,
          model: res.demo ? 'Demo engine' : res.model,
          artifactId,
        }));

        // lightweight long-term memory from explicit statements
        if (/(^|\b)(remember|note that|i prefer|my name is|always|never)\b/i.test(trimmed)) {
          addMemory(trimmed.slice(0, 220), 'chat');
        }
        if (res.fellBackFrom.length) {
          toast(`Fallback: ${res.fellBackFrom[0].slice(0, 60)}…`);
        }
      } catch (err) {
        if (timer !== null) clearTimeout(timer);
        const aborted = (err as Error)?.name === 'AbortError';
        patchAssistant((m) => ({
          ...m,
          streaming: false,
          error: !aborted,
          content:
            m.content ||
            (aborted ? '_Stopped._' : `**Engine error**\n\n\`${(err as Error).message}\``),
        }));
      } finally {
        delete abortRef.current[convId];
        setStreamingIds((s) => s.filter((x) => x !== convId));
        patchConversation(convId, (c) => ({ ...c, updatedAt: Date.now() }));
      }
      return savedArtifactId;
    },
    [addMemory, patchConversation, saveArtifact, toast]
  );

  const stopStream = useCallback((convId: string) => {
    abortRef.current[convId]?.abort();
  }, []);

  /* ---------------------- automations engine ---------------------- */

  const isAdmin = db.settings.role === 'admin';
  const canSeeCase = useCallback(
    (c: VisaCase) =>
      isAdmin || !c.owner || c.owner === 'local' || c.owner === db.settings.email,
    [isAdmin, db.settings.email]
  );
  const visibleCases = useMemo(
    () => db.visaCases.filter((c) => canSeeCase(c)),
    [db.visaCases, canSeeCase]
  );

  const addVisaCase = useCallback((country: string) => {
    const now = Date.now();
    const jc = byCode(country);
    const item: VisaCase = {
      id: uid('vc_'),
      owner: dbRef.current.settings.email || 'local',
      docs: [],
      token: token(jc.code),
      country: jc.code,
      applicant: emptyApplicant(),
      checks: [],
      stage: 1,
      log: [{ at: now, text: `Case opened for ${jc.country} (${jc.system})`, level: 'info' }],
      createdAt: now,
      updatedAt: now,
    };
    setDB((d) => ({ ...d, visaCases: [item, ...d.visaCases] }));
    return item;
  }, []);

  const updateVisaCase = useCallback((id: string, patch: Partial<VisaCase>) => {
    setDB((d) => ({
      ...d,
      visaCases: d.visaCases.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)),
    }));
  }, []);

  const deleteVisaCase = useCallback((id: string) => {
    setDB((d) => ({ ...d, visaCases: d.visaCases.filter((c) => c.id !== id) }));
  }, []);

  const addAutomation = useCallback(
    (a: Omit<Automation, 'id' | 'runs' | 'nextRun' | 'lastRun'>) => {
      const auto: Automation = {
        ...a,
        id: uid('au_'),
        runs: [],
        nextRun: nextRunFor(a.cadence, a.hour, a.minute, a.weekday),
      };
      setDB((d) => ({ ...d, automations: [auto, ...d.automations] }));
      toast('Automation created and scheduled');
    },
    [toast]
  );

  const updateAutomation = useCallback((id: string, patch: Partial<Automation>) => {
    setDB((d) => {
      const automations = d.automations.map((a) => {
        if (a.id !== id) return a;
        const merged = { ...a, ...patch };
        if (
          patch.cadence !== undefined ||
          patch.hour !== undefined ||
          patch.minute !== undefined ||
          patch.weekday !== undefined ||
          patch.enabled === true
        ) {
          merged.nextRun = nextRunFor(merged.cadence, merged.hour, merged.minute, merged.weekday);
        }
        return merged;
      });
      return { ...d, automations };
    });
  }, []);

  const deleteAutomation = useCallback((id: string) => {
    setDB((d) => ({ ...d, automations: d.automations.filter((a) => a.id !== id) }));
  }, []);

  const runAutomation = useCallback(
    async (id: string) => {
      const d = dbRef.current;
      const auto = d.automations.find((a) => a.id === id);
      if (!auto) return;
      setRunLog((l) => [`${new Date().toLocaleTimeString()} · ${auto.title} started`, ...l].slice(0, 40));

      const convId = `auto_conv_${auto.id}`;
      const existing = dbRef.current.conversations.find((c) => c.id === convId);
      if (!existing) {
        const conv: Conversation = {
          id: convId,
          title: auto.title,
          agentId: auto.agentId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        };
        setDB((prev) => ({ ...prev, conversations: [conv, ...prev.conversations] }));
        await new Promise((r) => setTimeout(r, 30));
      }

      const createdArtifactId = await sendMessage(convId, auto.prompt);

      const after = dbRef.current.conversations.find((c) => c.id === convId);
      const last = [...(after?.messages || [])].reverse().find((m) => m.role === 'assistant');
      const body = last?.content || '';
      // reuse the artifact auto-saved with the message, so one run = one deliverable
      const autoTitle = `${auto.title} — ${new Date().toLocaleDateString()}`;
      let artifactId: string;
      if (createdArtifactId) {
        artifactId = createdArtifactId;
        setDB((prev) => ({
          ...prev,
          artifacts: prev.artifacts.map((a) =>
            a.id === createdArtifactId
              ? { ...a, folder: 'Automations', tags: ['automation'], title: autoTitle }
              : a
          ),
        }));
      } else {
        artifactId = saveArtifact({
          title: autoTitle,
          body: body || '_No output produced._',
          folder: 'Automations',
          conversationId: convId,
          agentId: auto.agentId,
          tags: ['automation'],
        }).id;
      }

      setDB((prev) => ({
        ...prev,
        automations: prev.automations.map((a) =>
          a.id === id
            ? {
                ...a,
                lastRun: Date.now(),
                nextRun: nextRunFor(a.cadence, a.hour, a.minute, a.weekday, Date.now() + 60000),
                runs: [
                  {
                    id: uid('r_'),
                    at: Date.now(),
                    status: (body ? 'ok' : 'error') as 'ok' | 'error',
                    summary: (body || 'no output').slice(0, 160),
                    artifactId,
                  },
                  ...a.runs,
                ].slice(0, 20),
              }
            : a
        ),
      }));
      setRunLog((l) =>
        [
          `${new Date().toLocaleTimeString()} · ${auto.title} finished → artifact saved`,
          ...l,
        ].slice(0, 40)
      );
      toast(`Automation ran: ${auto.title}`);
    },
    [saveArtifact, sendMessage, toast]
  );

  // scheduler — real client-side cron loop
  useEffect(() => {
    if (schedulerStarted.current) return;
    schedulerStarted.current = true;
    const tick = () => {
      const now = Date.now();
      const due = dbRef.current.automations.filter((a) => a.enabled && a.nextRun <= now);
      due.forEach((a) => {
        void runAutomation(a.id);
      });
    };
    const iv = window.setInterval(tick, 20000);
    return () => window.clearInterval(iv);
  }, [runAutomation]);

  const value = useMemo<Ctx>(
    () => ({
      db,
      route,
      navigate,
      toasts,
      toast,
      setSettings,
      signIn,
      signOut,
      newConversation,
      deleteConversation,
      togglePin,
      renameConversation,
      sendMessage,
      stopStream,
      streamingIds,
      rateMessage,
      addAgent,
      deleteAgent,
      saveArtifact,
      updateArtifact,
      deleteArtifact,
      addMemory,
      deleteMemory,
      addVisaCase,
      visibleCases,
      canSeeCase,
      updateVisaCase,
      deleteVisaCase,
      addAutomation,
      updateAutomation,
      deleteAutomation,
      runAutomation,
      runLog,
    }),
    [
      db,
      route,
      navigate,
      toasts,
      toast,
      setSettings,
      signIn,
      signOut,
      newConversation,
      deleteConversation,
      togglePin,
      renameConversation,
      sendMessage,
      stopStream,
      streamingIds,
      rateMessage,
      addAgent,
      deleteAgent,
      saveArtifact,
      updateArtifact,
      deleteArtifact,
      addMemory,
      deleteMemory,
      addVisaCase,
      visibleCases,
      canSeeCase,
      updateVisaCase,
      deleteVisaCase,
      addAutomation,
      updateAutomation,
      deleteAutomation,
      runAutomation,
      runLog,
    ]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}

export type { ModelKey };
