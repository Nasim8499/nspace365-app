import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import Markdown from '../lib/md';
import { JURISDICTIONS, PURPOSES, byCode } from '../lib/knowledge';
import { fullName, type Check, type VisaCase } from '../lib/dossier';
import { streamChat } from '../lib/llm';
import { SKILLS } from '../lib/skills';

type Tab = 'cases' | 'documents' | 'tasks' | 'brief';

const TASKS = [
  { key: 'intake', label: 'Passport intake', agent: 'Passport Intake Specialist', skill: 'passport-mrz' },
  { key: 'mrz', label: 'MRZ + check digits', agent: 'Passport Intake Specialist', skill: 'passport-mrz' },
  { key: 'rules', label: 'Knowledge-base validation', agent: 'Visa Case Officer', skill: 'kb-validate' },
  { key: 'dossier', label: 'PDF dossier compiled', agent: 'Dossier Writer', skill: 'dossier-composer' },
  { key: 'payload', label: 'Portal payload mapped', agent: 'Portal Navigator', skill: 'field-mapper' },
  { key: 'run', label: 'Live portal run', agent: 'Portal Navigator', skill: 'portal-run' },
  { key: 'approval', label: 'Staff approval', agent: 'Visa Case Officer', skill: 'doc-audit' },
] as const;

function taskState(c: VisaCase, key: string): 'done' | 'active' | 'todo' {
  const states: Record<string, boolean> = {
    intake: Boolean(c.applicant.passportNo && c.applicant.surname),
    mrz: Boolean(c.mrzOk),
    rules: Boolean(c.checks?.length) && !(c.checks || []).some((x: Check) => x.level === 'fail'),
    dossier: Boolean(c.dossierAt),
    payload: Boolean(c.payload),
    run: Boolean(c.run?.startedAt),
    approval: Boolean(c.run?.approvedAt),
  };
  const order = TASKS.map((t) => t.key);
  if (states[key]) return 'done';
  const firstOpen = order.find((k) => !states[k]);
  return firstOpen === key ? 'active' : 'todo';
}

const progressOf = (c: VisaCase) => {
  const done = TASKS.filter((t) => taskState(c, t.key) === 'done').length;
  return { done, pct: Math.round((done / TASKS.length) * 100) };
};

const docKind = (name: string): string => {
  const n = name.toLowerCase();
  if (/passport|mrz/.test(n)) return 'passport';
  if (/bank|statement|fund/.test(n)) return 'bank';
  if (/employ|salary|noc|contract/.test(n)) return 'employment';
  if (/ticket|itiner|flight|hotel/.test(n)) return 'itinerary';
  if (/insur|policy/.test(n)) return 'insurance';
  return 'other';
};

const countryFrom = (text: string) => {
  const t = text.toLowerCase();
  const hit = JURISDICTIONS.find(
    (j) => t.includes(j.country.toLowerCase()) || t.includes(j.code.toLowerCase()) || t.includes(j.system.toLowerCase())
  );
  return hit?.code || '';
};

const purposeFrom = (text: string) => {
  const t = text.toLowerCase();
  return PURPOSES.find((p) => t.includes(p.toLowerCase().split(' ')[0])) || 'Tourism';
};

export default function Dashboard() {
  const { db, navigate, addVisaCase, updateVisaCase, toast, visibleCases } = useApp();
  const admin = db.settings.role === 'admin';
  const [tab, setTab] = useState<Tab>('cases');
  const [docCase, setDocCase] = useState(visibleCases[0]?.id || '');
  const [brief, setBrief] = useState('');
  const [briefFiles, setBriefFiles] = useState<{ name: string; text: string }[]>([]);
  const [answer, setAnswer] = useState('');
  const [thinking, setThinking] = useState(false);
  const [model, setModel] = useState('');
  const abort = useRef<AbortController | null>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const briefInput = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const cases = visibleCases;
    const filed = cases.filter((c) => c.run?.approvedAt).length;
    const review = cases.filter((c) => c.run?.haltedAt && !c.run?.approvedAt).length;
    const docs = cases.reduce((n, c) => n + (c.docs?.length || 0), 0);
    const openTasks = cases.reduce(
      (n, c) => n + TASKS.filter((t) => taskState(c, t.key) !== 'done').length,
      0
    );
    return { cases: cases.length, filed, review, docs, openTasks };
  }, [visibleCases]);

  const addDocs = (files: FileList | null) => {
    const target = visibleCases.find((c) => c.id === docCase);
    if (!target || !files?.length) return;
    const added = Array.from(files).map((f, i) => ({
      id: `d_${Date.now()}_${i}`,
      name: f.name,
      size: f.size,
      type: f.type || 'file',
      addedAt: Date.now(),
      kind: docKind(f.name) as never,
    }));
    updateVisaCase(target.id, {
      docs: [...(target.docs || []), ...added],
      log: [
        ...target.log,
        { at: Date.now(), text: `${added.length} document(s) uploaded: ${added.map((a) => a.name).join(', ')}`, level: 'ok' },
      ],
    });
    toast(`${added.length} document(s) added to ${target.token}`);
  };

  const analyze = async () => {
    if (!brief.trim()) return toast('Describe the case first');
    setThinking(true);
    setAnswer('');
    abort.current = new AbortController();
    const context = briefFiles.map((f) => `\n\n--- attached: ${f.name} ---\n${f.text.slice(0, 4000)}`).join('');
    try {
      const res = await streamChat({
        model: 'auto',
        settings: db.settings,
        signal: abort.current.signal,
        messages: [
          {
            role: 'system',
            content:
              'You are a visa case analyst for a Bangladesh-based agency handling Australia, Serbia, Russia, Türkiye, Singapore, Malaysia, Saudi Arabia and Bahrain. From the applicant note, return Markdown with exactly these sections: "## Case summary", "## Extracted details" (bullet list: full name, passport number, nationality, date of birth, passport expiry, destination, travel dates, purpose, funds), "## Missing documents" (bullets), "## Recommended next steps" (numbered, concrete, ordered), "## Risk flags" (bullets, or "None identified"). Never invent passport numbers or dates: write "not provided" when absent.',
          },
          { role: 'user', content: brief + context },
        ],
        onToken: (d) => setAnswer((a) => a + d),
        onStatus: (s) => setModel(s),
      });
      setModel(`${res.model} · ${res.provider}${res.demo ? ' (demo engine)' : ''}`);
    } catch (e) {
      if (!(e as Error).name.includes('abort')) toast('Analysis failed: ' + (e as Error).message);
    } finally {
      setThinking(false);
    }
  };

  const createFromBrief = () => {
    const code = countryFrom(brief + ' ' + answer) || 'AU';
    const c = addVisaCase(code);
    const purpose = purposeFrom(brief);
    updateVisaCase(c.id, {
      applicant: { ...c.applicant, purpose },
      log: [
        { at: Date.now(), text: `Case opened from an AI brief. Purpose detected: ${purpose}`, level: 'info' },
        ...(answer ? [{ at: Date.now(), text: 'AI recommendations attached to the file', level: 'ok' as const }] : []),
      ],
    });
    toast(`Case opened for ${byCode(code).country}`);
    navigate(`/visa/${c.id}`);
  };

  return (
    <div className="page dashpage">
      <div className="pagehead">
        <div>
          <div className="h1">Welcome back, {db.settings.name || 'there'}</div>
          <div className="sub">
            {admin ? 'Agency admin view — every case, document and agent task.' : 'Your visa cases, documents and agent progress.'}{' '}
            <span className={`rolechip ${admin ? 'admin' : ''}`}>{admin ? 'ADMIN' : 'APPLICANT'}</span>
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <button
          className="btn sm"
          onClick={() => {
            const c = addVisaCase('AU');
            navigate(`/visa/${c.id}`);
          }}
        >
          <Icon name="plus" size={15} /> New case
        </button>
        <button className="btn primary sm" onClick={() => setTab('brief')}>
          <Icon name="sparkles" size={15} /> AI case intake
        </button>
      </div>

      <div className="pagebody dashbody">
        <div className="dashstats">
          {[
            { k: 'Cases', v: stats.cases, icon: 'passport', to: 'cases' as Tab },
            { k: 'Awaiting review', v: stats.review, icon: 'clock', to: 'tasks' as Tab },
            { k: 'Filed', v: stats.filed, icon: 'check', to: 'cases' as Tab },
            { k: 'Documents', v: stats.docs, icon: 'doc', to: 'documents' as Tab },
            { k: 'Open agent tasks', v: stats.openTasks, icon: 'bot', to: 'tasks' as Tab },
          ].map((s) => (
            <button className="dashstat" key={s.k} onClick={() => setTab(s.to)}>
              <span className="dashstat-icon">
                <Icon name={s.icon} size={16} />
              </span>
              <span className="dashstat-v">{s.v}</span>
              <span className="dashstat-k">{s.k}</span>
            </button>
          ))}
        </div>

        <div className="tabs dashtabs">
          {(
            [
              ['cases', 'Cases'],
              ['documents', 'Documents'],
              ['tasks', 'Agent tasks'],
              ['brief', 'AI intake'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button key={k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)} data-testid={`tab-${k}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'cases' && (
          <div className="dashpanel">
            {visibleCases.length === 0 ? (
              <div className="empty">
                <Icon name="passport" size={24} />
                <div className="h2">No cases yet</div>
                <div className="sub">Open a case or describe it in the AI intake tab.</div>
              </div>
            ) : (
              <div className="dashtable" data-testid="cases-table">
                <div className="dashtr dashth">
                  <span>Case</span>
                  <span>Applicant</span>
                  <span>Destination</span>
                  <span>Agent progress</span>
                  <span>Docs</span>
                  {admin && <span>Owner</span>}
                  <span />
                </div>
                {visibleCases.map((c) => {
                  const j = byCode(c.country);
                  const p = progressOf(c);
                  return (
                    <div className="dashtr" key={c.id}>
                      <span className="dashtoken">{c.token}</span>
                      <span>{fullName(c.applicant)}</span>
                      <span>
                        {j.flag} {j.country}
                        {c.run?.approvedAt ? <em className="dashfiled">filed</em> : null}
                      </span>
                      <span className="dashprog">
                        <span className="dashbar">
                          <i style={{ width: `${p.pct}%` }} />
                        </span>
                        <em>
                          {p.done}/{TASKS.length}
                        </em>
                      </span>
                      <span>{c.docs?.length || 0}</span>
                      {admin && <span className="dashowner">{c.owner || 'local'}</span>}
                      <span>
                        <button className="btn xs" onClick={() => navigate(`/visa/${c.id}`)}>
                          Open
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'documents' && (
          <div className="dashpanel">
            <div className="dashdocrow">
              <div>
                <div className="h2">Upload documents</div>
                <div className="sub">Attach passports, bank statements, employment and travel proof to a case.</div>
              </div>
              <span style={{ flex: 1 }} />
              <select className="select" style={{ width: 240 }} value={docCase} onChange={(e) => setDocCase(e.target.value)} data-testid="doc-case">
                {visibleCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.token} · {fullName(c.applicant)}
                  </option>
                ))}
              </select>
              <button className="btn primary sm" onClick={() => docInput.current?.click()} data-testid="upload-docs">
                <Icon name="clip" size={14} /> Choose files
              </button>
              <input
                ref={docInput}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  addDocs(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            <div className="dashtable docs" data-testid="docs-table">
              <div className="dashtr dashth">
                <span>Document</span>
                <span>Kind</span>
                <span>Case</span>
                <span>Size</span>
                <span />
              </div>
              {visibleCases.flatMap((c) =>
                (c.docs || []).map((d) => (
                  <div className="dashtr" key={d.id}>
                    <span className="docname">
                      <Icon name="doc" size={13} /> {d.name}
                    </span>
                    <span className="badge">{d.kind}</span>
                    <span className="dashtoken">{c.token}</span>
                    <span>{(d.size / 1024).toFixed(0)} KB</span>
                    <span>
                      <button
                        className="iconbtn"
                        aria-label="Remove"
                        onClick={() =>
                          updateVisaCase(c.id, { docs: (c.docs || []).filter((x) => x.id !== d.id) })
                        }
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </span>
                  </div>
                ))
              )}
              {stats.docs === 0 && <div className="dashempty">No documents uploaded yet.</div>}
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <div className="dashpanel">
            {visibleCases.length === 0 && <div className="dashempty">No cases, so no agent tasks yet.</div>}
            {visibleCases.map((c) => (
              <div className="taskcard" key={c.id}>
                <div className="taskhead">
                  <div>
                    <div style={{ fontWeight: 640 }}>{c.token} · {fullName(c.applicant)}</div>
                    <div className="sub" style={{ fontSize: 12 }}>
                      {byCode(c.country).flag} {byCode(c.country).country} · {progressOf(c).done}/{TASKS.length} agent steps done
                    </div>
                  </div>
                  <span style={{ flex: 1 }} />
                  <button className="btn xs" onClick={() => navigate(`/visa/${c.id}`)}>
                    Open case
                  </button>
                </div>
                <div className="tasklist">
                  {TASKS.map((t) => {
                    const st = taskState(c, t.key);
                    return (
                      <div className={`taskrow ${st}`} key={t.key}>
                        <span className={`dot ${st}`} />
                        <span className="tasklabel">{t.label}</span>
                        <span className="taskagent">{t.agent}</span>
                        <span className="taskstate">
                          {st === 'done' ? 'Done' : st === 'active' ? 'In progress' : 'Queued'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'brief' && (
          <div className="dashpanel briefpanel">
            <div className="briefleft">
              <div className="h2">Describe the case in your own words</div>
              <div className="sub">
                The model extracts the key details, lists the missing documents and writes the next steps. Attach
                text or notes to give it more to work with.
              </div>
              <textarea
                className="textarea"
                rows={7}
                placeholder="Example: Mohammed Saiful Islam, Bangladeshi passport BM0948216 expiring 2031, wants to visit Australia for business meetings 12–22 March 2027, hotel booked in Sydney, funds 5200 USD, employed at VisaMOTion 365."
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                style={{ marginTop: 10 }}
                data-testid="brief-text"
              />
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={() => briefInput.current?.click()}>
                  <Icon name="clip" size={14} /> Attach notes
                </button>
                <input
                  ref={briefInput}
                  type="file"
                  multiple
                  hidden
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    const read = await Promise.all(
                      files.map(async (f) => ({
                        name: f.name,
                        text: /\.(txt|md|csv|json)$/i.test(f.name) ? await f.text() : `(binary ${f.type || 'file'}, ${(f.size / 1024).toFixed(0)} KB)`,
                      }))
                    );
                    setBriefFiles((p) => [...p, ...read]);
                    e.target.value = '';
                  }}
                />
                <button className="btn primary sm" onClick={analyze} disabled={thinking} data-testid="analyze">
                  <Icon name="sparkles" size={14} /> {thinking ? 'Analysing…' : 'Analyse with AI'}
                </button>
                {thinking && (
                  <button className="btn sm ghost" onClick={() => abort.current?.abort()}>
                    Stop
                  </button>
                )}
                {answer && (
                  <button className="btn sm" onClick={createFromBrief} data-testid="case-from-brief">
                    <Icon name="plus" size={14} /> Open a case from this
                  </button>
                )}
              </div>
              {briefFiles.length > 0 && (
                <div className="briefdocs">
                  {briefFiles.map((f, i) => (
                    <span className="badge" key={i}>
                      <Icon name="doc" size={11} /> {f.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="briefright" data-testid="brief-answer">
              {answer ? (
                <>
                  <Markdown text={answer} />
                  {model && <div className="briefmodel">{model}</div>}
                </>
              ) : (
                <div className="dashempty" style={{ border: 0 }}>
                  The analysis will appear here: extracted details, missing documents, recommended next steps and risk
                  flags.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="dashnote">
          <Icon name="shield" size={14} />
          {admin
            ? 'Admin access: all cases, all uploads, all agent runs. Applicant accounts never see another person’s file.'
            : 'Your account is scoped to your own cases. The agency admin sees the full pipeline.'}{' '}
          {SKILLS.length} built-in skills power the agents.
        </div>
      </div>
    </div>
  );
}
