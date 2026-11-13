import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/store';
import Icon from '../components/Icon';
import Markdown from '../lib/md';
import LiveScreen, { type RunRow } from '../components/LiveScreen';
import { JURISDICTIONS, NATIONALITIES, PURPOSES, byCode } from '../lib/knowledge';
import { parseMrz, SAMPLE_MRZ, type MrzResult } from '../lib/mrz';
import {
  applyMrz,
  checksPass,
  dossierMarkdown,
  dossierPdf,
  fullName,
  portalPayload,
  runChecks,
  type Applicant,
  type Check,
} from '../lib/dossier';
import { buildPdf, downloadBlob } from '../lib/pdf';
import { SKILLS } from '../lib/skills';

const STEPS = [
  { n: 1, label: 'Passport intake' },
  { n: 2, label: 'Extract & validate' },
  { n: 3, label: 'PDF dossier' },
  { n: 4, label: 'Portal hand-off' },
  { n: 5, label: 'Live apply' },
  { n: 6, label: 'Staff review' },
];

function Field({
  label,
  value,
  onChange,
  type = 'text',
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  options?: string[];
  placeholder?: string;
}) {
  const tid = `f-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  return (
    <label className="vfield">
      <span className="label">{label}</span>
      {options ? (
        <select className="select" data-testid={tid} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="input"
          data-testid={tid}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

export default function Visa({ caseId }: { caseId?: string }) {
  const { db, navigate, addVisaCase, updateVisaCase, deleteVisaCase, saveArtifact, toast, visibleCases, canSeeCase } =
    useApp();
  const cases = visibleCases;
  const wanted = caseId ? db.visaCases.find((c) => c.id === caseId) : undefined;
  const denied = Boolean(wanted && !canSeeCase(wanted));
  const active = denied ? undefined : cases.find((c) => c.id === caseId) || cases[0];
  const admin = db.settings.role === 'admin';
  const jur = byCode(active?.country || 'AU');

  const [mrzText, setMrzText] = useState('');
  const [parsed, setParsed] = useState<MrzResult | null>(null);
  const [stage, setStage] = useState(active?.stage || 1);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [maxStage, setMaxStage] = useState(active?.stage || 1);
  const [skillOpen, setSkillOpen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active || !caseId) return;
    setStage(active.stage);
    setMaxStage(active.stage);
    setReviewOpen(false);
    setRunning(false);
    setParsed(null);
    setMrzText(active.mrz || '');
  }, [caseId]);

  const checks: Check[] = useMemo(
    () => (active ? runChecks(active.applicant, jur, parsed || undefined) : []),
    [active, jur, parsed]
  );

  const rows: RunRow[] = useMemo(() => {
    if (!active) return [];
    return jur.fields.map((f) => ({
      portal: f.portal,
      label: f.label,
      type: f.type,
      options: f.options,
      required: f.required,
      value:
        f.type === 'file'
          ? active.applicant.photoName || `${active.token}-dossier.pdf`
          : portalPayload(active.applicant, jur)[f.portal] || '',
    }));
  }, [jur, active?.applicant, active?.token]);

  if (denied) {
    return (
      <div className="page">
        <div className="pagehead">
          <div>
            <div className="h1">No access to this case</div>
            <div className="sub">This file belongs to another applicant. Ask the agency admin for access.</div>
          </div>
        </div>
        <div className="empty">
          <Icon name="lock" size={24} />
          <div className="h2">Case is outside your account</div>
          <button className="btn sm" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="page">
        <div className="pagehead">
          <div>
            <div className="h1">Visa Automate</div>
            <div className="sub">Passport intake → dossier → portal run → staff approval.</div>
          </div>
        </div>
        <div className="empty">
          <Icon name="passport" size={26} />
          <div className="h2">No case open yet</div>
          <div className="sub" style={{ maxWidth: 420 }}>
            Open a case, paste the passport MRZ or type the bio data, and the pipeline builds the dossier and
            walks the official portal.
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {JURISDICTIONS.map((j) => (
              <button
                key={j.code}
                className="btn sm"
                onClick={() => {
                  const c = addVisaCase(j.code);
                  navigate(`/visa/${c.id}`);
                }}
              >
                {j.flag} {j.country}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const app = active.applicant;
  const setApp = (patch: Partial<Applicant>) =>
    updateVisaCase(active.id, { applicant: { ...app, ...patch } });

  const log = (text: string, level: 'info' | 'ok' | 'warn' | 'error' = 'info') =>
    updateVisaCase(active.id, {
      log: [...active.log, { at: Date.now(), text, level }],
    });

  const parse = () => {
    const result = parseMrz(mrzText || SAMPLE_MRZ);
    setParsed(result);
    const next = applyMrz(app, result);
    const nextChecks = runChecks(next, jur, result);
    updateVisaCase(active.id, {
      applicant: next,
      mrz: result.raw || mrzText,
      mrzOk: result.ok,
      checks: nextChecks,
      stage: Math.max(2, active.stage),
      log: [
        ...active.log,
        {
          at: Date.now(),
          text: result.ok
            ? `MRZ verified: ${result.passportNo} · ${result.surname}, ${result.givenNames} (check digits pass)`
            : `MRZ parsed with ${result.issues.filter((i) => i.level === 'error').length} blocking issue(s)`,
          level: result.ok ? 'ok' : 'error',
        },
      ],
    });
    setMaxStage((m) => Math.max(m, 2));
    toast(result.ok ? 'MRZ verified with ICAO check digits' : 'MRZ has blocking issues');
  };

  const validateAndContinue = () => {
    const result = parseMrz(mrzText || SAMPLE_MRZ);
    setParsed(result);
    const next = applyMrz(app, result);
    updateVisaCase(active.id, {
      applicant: next,
      mrz: result.raw || mrzText,
      mrzOk: result.ok,
      checks: runChecks(next, jur, result),
      stage: 2,
      log: [
        ...active.log,
        {
          at: Date.now(),
          text: result.ok
            ? `MRZ verified (${result.passportNo}) and validated against the ${jur.country} rule set`
            : `MRZ has ${result.issues.filter((i) => i.level === 'error').length} blocking issue(s)`,
          level: result.ok ? 'ok' : 'error',
        },
      ],
    });
    setStage(2);
    setMaxStage((m) => Math.max(m, 2));
  };

  const goStage = (n: number) => {
    if (n > maxStage) return;
    setStage(n);
    updateVisaCase(active.id, { stage: n });
  };

  const buildDossier = () => {
    const md = dossierMarkdown(app, jur, checks, active.token);
    const art = saveArtifact({
      title: `${jur.country} dossier — ${fullName(app)} — ${active.token}`,
      body: md,
      folder: 'Visa',
      tags: ['visa', jur.code, 'dossier'],
    });
    updateVisaCase(active.id, {
      dossierAt: Date.now(),
      artifactId: art.id,
      checks,
      stage: 3,
      log: [...active.log, { at: Date.now(), text: `Dossier generated (${art.id}) and saved to Artifacts`, level: 'ok' }],
    });
    setStage(3);
    setMaxStage((m) => Math.max(m, 3));
    toast('Dossier built and saved as an artifact');
  };

  const downloadPdf = () => {
    const blob = buildPdf(dossierPdf(app, jur, checks, active.token));
    downloadBlob(blob, `dossier-${active.token}.pdf`);
    log(`PDF dossier downloaded (${(blob.size / 1024).toFixed(0)} KB)`, 'ok');
    toast('PDF dossier downloaded');
  };

  const goPortal = () => {
    const payload = portalPayload(app, jur);
    updateVisaCase(active.id, {
      payload,
      stage: 4,
      log: [
        ...active.log,
        {
          at: Date.now(),
          text: `Portal payload prepared: ${Object.keys(payload).length} fields mapped to ${jur.system}`,
          level: 'ok',
        },
      ],
    });
    setStage(4);
    setMaxStage((m) => Math.max(m, 4));
  };

  const startRun = () => {
    const blocked = checks.filter((c) => c.level === 'fail');
    if (blocked.length) {
      toast(`Blocked: ${blocked[0].label}`);
      return;
    }
    setStage(5);
    setMaxStage((m) => Math.max(m, 5));
    setRunning(true);
    updateVisaCase(active.id, {
      stage: 5,
      run: { startedAt: Date.now(), fieldCount: rows.length },
      log: [...active.log, { at: Date.now(), text: `Browser run started on ${jur.system} (${rows.length} fields)`, level: 'info' }],
    });
  };

  const onHalt = () => {
    updateVisaCase(active.id, {
      run: { ...(active.run || { startedAt: Date.now(), fieldCount: rows.length }), haltedAt: Date.now() },
      log: [
        ...active.log,
        { at: Date.now(), text: 'HITL halt: agent stopped before submit and payment', level: 'warn' },
      ],
    });
    setReviewOpen(true);
  };

  const approve = () => {
    const ref = `${jur.code}-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000 + 100000)}`;
    updateVisaCase(active.id, {
      stage: 6,
      run: { ...(active.run || { startedAt: Date.now(), fieldCount: rows.length }), approvedAt: Date.now(), reference: ref },
      log: [
        ...active.log,
        { at: Date.now(), text: `Staff approved ${fullName(app)} for ${jur.country}. Reference ${ref}.`, level: 'ok' },
      ],
    });
    setReviewOpen(false);
    setMaxStage(6);
    setStage(6);
    toast(`Approved · ${ref}`);
  };

  const verdict = checks.filter((c) => c.level === 'fail').length
    ? 'block'
    : checks.some((c) => c.level === 'warn')
      ? 'warn'
      : 'ok';
  const done = active.run?.approvedAt ? 'Filed' : running ? 'Running' : verdict === 'block' ? 'Blocked' : 'Ready';

  return (
    <div className="page visapage">
      <div className="pagehead visapagehead">
        <div style={{ minWidth: 220 }}>
          <div className="h1">Visa Automate</div>
          <div className="sub">
            Passport intake → verified dossier → live portal run with a human gate. {cases.length} case
            {cases.length === 1 ? '' : 's'} open.
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <span className={`vstatus ${done.toLowerCase()}`}>{done}</span>
        <button
          className="btn sm"
          onClick={() => {
            const pick = JURISDICTIONS[Math.floor(Math.random() * JURISDICTIONS.length)];
            const c = addVisaCase(pick.code);
            navigate(`/visa/${c.id}`);
          }}
          data-testid="new-case"
        >
          <Icon name="plus" size={15} /> New case
        </button>
      </div>

      <div className="pagebody visabody">
        <aside className="visacases">
          <div className="label" style={{ padding: '0 4px 8px' }}>Cases</div>
          <div className="visacaselist">
            {cases.map((c) => {
              const cj = byCode(c.country);
              const on = c.id === active.id;
              return (
                <button
                  key={c.id}
                  className={`vcase${on ? ' on' : ''}`}
                  onClick={() => navigate(`/visa/${c.id}`)}
                >
                  <span className="vcaseflag">{cj.flag}</span>
                  <span className="vcasemeta">
                    <span className="vcasetitle">{fullName(c.applicant)}</span>
                    <span className="vcasetoken">
                      {c.token}
                      {admin && c.owner ? ` · ${c.owner}` : ''}
                    </span>
                  </span>
                  <span className={`vstage st${c.stage}`}>
                    {c.run?.approvedAt ? 'Filed' : `S${c.stage}`}
                  </span>
                </button>
              );
            })}
          </div>
          {active.run?.reference && (
            <div className="vrefcard">
              <Icon name="stamp" size={16} />
              <div>
                <div className="label" style={{ margin: 0 }}>Reference</div>
                <div style={{ fontWeight: 650 }}>{active.run.reference}</div>
              </div>
            </div>
          )}
          <div className="vcard-actions">
            <button
              className="btn ghost sm"
              onClick={() => {
                deleteVisaCase(active.id);
                navigate('/visa');
              }}
            >
              <Icon name="trash" size={14} /> Delete case
            </button>
          </div>
        </aside>

        <main className="visawork">
          <div className="stepper" role="tablist">
            {STEPS.map((s) => {
              const locked = s.n > maxStage;
              const on = stage === s.n;
              return (
                <button
                  key={s.n}
                  className={`step${on ? ' on' : ''}${locked ? ' locked' : ''}`}
                  onClick={() => goStage(s.n)}
                  disabled={locked}
                >
                  <span className="stepnum">{locked ? <Icon name="lock" size={11} /> : s.n}</span>
                  <span className="steplabel">{s.label}</span>
                </button>
              );
            })}
          </div>

          {stage === 1 && (
            <section className="vpanel">
              <div className="vpanelhead">
                <div>
                  <div className="h2">Passport intake</div>
                  <div className="sub">
                    Jurisdiction {jur.flag} {jur.country} · {jur.system}. Paste the two MRZ lines or type the bio
                    data.
                  </div>
                </div>
              </div>

              <div className="vgrid2">
                <div className="vsub">
                  <div className="label">MRZ line 1 and 2</div>
                  <textarea
                    className="textarea mrzbox"
                    rows={3}
                    spellCheck={false}
                    value={mrzText}
                    placeholder="P<BGDRAHMAN<<MOHAMMED<SAIFUL<ISLAM<<<<<<<<<<<<<<"
                    onChange={(e) => setMrzText(e.target.value)}
                    data-testid="mrz"
                  />
                  <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button className="btn primary sm" onClick={parse} data-testid="parse-mrz">
                      <Icon name="scan" size={15} /> Read passport
                    </button>
                    <button className="btn sm" onClick={() => setMrzText(SAMPLE_MRZ)}>
                      Use sample
                    </button>
                    <button
                      className="btn sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Icon name="image" size={14} /> Attach scan
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,application/pdf"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setApp({ photoName: f.name });
                          log(`Bio page attached: ${f.name}`, 'ok');
                          toast('Scan attached to the case');
                        }
                      }}
                    />
                  </div>
                  {parsed && (
                    <div className={`mrzout${parsed.ok ? ' ok' : ' bad'}`} data-testid="mrz-out">
                      <strong>{parsed.ok ? 'Check digits verified' : 'Blocking issues'}</strong>
                      <div style={{ marginTop: 4 }}>
                        {parsed.passportNo || '—'} · {parsed.surname}, {parsed.givenNames} ·{' '}
                        {parsed.nationality || '—'} · DOB {parsed.birthDate || '—'} · exp {parsed.expiryDate || '—'}
                      </div>
                      {parsed.issues.length > 0 && (
                        <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                          {parsed.issues.map((i, k) => (
                            <li key={k} style={{ fontSize: 12.5 }}>
                              {i.level === 'error' ? '⛔ ' : '⚠️ '}
                              {i.text}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="vsub">
                  <div className="label">Jurisdiction</div>
                  <select
                    className="select"
                    value={active.country}
                    onChange={(e) => {
                      const next = byCode(e.target.value);
                      updateVisaCase(active.id, {
                        country: next.code,
                        log: [...active.log, { at: Date.now(), text: `Jurisdiction switched to ${next.country} (${next.system})`, level: 'info' }],
                      });
                      toast(`${next.flag} ${next.country} rule set loaded`);
                    }}
                    data-testid="jurisdiction"
                  >
                    {JURISDICTIONS.map((j) => (
                      <option key={j.code} value={j.code}>
                        {j.flag} {j.country} — {j.system}
                      </option>
                    ))}
                  </select>
                  <div className="kbmini" style={{ marginTop: 10 }}>
                    <div>
                      <span className="label" style={{ margin: 0 }}>Validity rule</span>
                      <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>{jur.validityRule}</div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <span className="label" style={{ margin: 0 }}>Portal</span>
                      <a href={jur.portalUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>
                        {jur.portalUrl.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="vgrid3">
                <Field label="Surname" value={app.surname} onChange={(v) => setApp({ surname: v })} />
                <Field label="Given names" value={app.givenNames} onChange={(v) => setApp({ givenNames: v })} />
                <Field label="Passport number" value={app.passportNo} onChange={(v) => setApp({ passportNo: v })} />
                <Field
                  label="Nationality"
                  value={app.nationality}
                  options={NATIONALITIES}
                  onChange={(v) => setApp({ nationality: v })}
                />
                <Field label="Date of birth" type="date" value={app.birthDate} onChange={(v) => setApp({ birthDate: v })} />
                <Field label="Passport expiry" type="date" value={app.expiryDate} onChange={(v) => setApp({ expiryDate: v })} />
                <Field label="Sex" value={app.sex === 'X' ? '' : app.sex} options={['M', 'F', 'X']} onChange={(v) => setApp({ sex: (v || 'X') as Applicant['sex'] })} />
                <Field label="Place of birth" value={app.placeOfBirth} onChange={(v) => setApp({ placeOfBirth: v })} />
                <Field label="Occupation" value={app.occupation} onChange={(v) => setApp({ occupation: v })} />
                <Field label="Employer" value={app.employer} onChange={(v) => setApp({ employer: v })} />
                <Field label="Email" value={app.email} onChange={(v) => setApp({ email: v })} />
                <Field label="Mobile" value={app.phone} onChange={(v) => setApp({ phone: v })} />
                <Field label="Residential address" value={app.address} onChange={(v) => setApp({ address: v })} />
                <Field label="Hotel / stay address" value={app.hotel} onChange={(v) => setApp({ hotel: v })} />
                <Field label="Arrival" type="date" value={app.arrival} onChange={(v) => setApp({ arrival: v })} />
                <Field label="Departure" type="date" value={app.departure} onChange={(v) => setApp({ departure: v })} />
                <Field label="Purpose" value={app.purpose} options={PURPOSES} onChange={(v) => setApp({ purpose: v })} />
                <Field label="Funds (USD)" value={app.funds} onChange={(v) => setApp({ funds: v })} />
                <Field label="Insurance policy no." value={app.insurance} onChange={(v) => setApp({ insurance: v })} />
                {jur.sponsor && (
                  <Field label="Sponsor NRIC / FIN" value={app.sponsor} onChange={(v) => setApp({ sponsor: v })} />
                )}
                <Field
                  label="Previous refusal (if any)"
                  value={app.previousRefusal}
                  onChange={(v) => setApp({ previousRefusal: v })}
                  placeholder="None"
                />
              </div>

              <div className="vfoot">
                <button className="btn primary" onClick={validateAndContinue} data-testid="intake-continue">
                  Validate against {jur.country} rules <Icon name="arrowRight" size={15} />
                </button>
              </div>
            </section>
          )}

          {stage === 2 && (
            <section className="vpanel">
              <div className="vpanelhead">
                <div>
                  <div className="h2">Extract &amp; validate</div>
                  <div className="sub">
                    {checks.filter((c) => c.level === 'ok').length} pass ·{' '}
                    {checks.filter((c) => c.level === 'warn').length} warn ·{' '}
                    {checks.filter((c) => c.level === 'fail').length} blocking
                  </div>
                </div>
                <span style={{ flex: 1 }} />
                <button
                  className="btn sm"
                  onClick={() => {
                    const next = runChecks(app, jur, parsed || undefined);
                    updateVisaCase(active.id, { checks: next, log: [...active.log, { at: Date.now(), text: 'Rule set re-run from scratch', level: 'info' }] });
                    toast('Checks re-run');
                  }}
                >
                  <Icon name="refresh" size={14} /> Re-run checks
                </button>
              </div>

              <div className="vchecks" data-testid="checks">
                {checks.map((c) => (
                  <div className={`vcheck ${c.level}`} key={c.id}>
                    <span className="vcheckdot">
                      <Icon name={c.level === 'ok' ? 'check' : c.level === 'warn' ? 'clock' : 'close'} size={12} />
                    </span>
                    <span className="vcheckbody">
                      <span className="vchecktitle">{c.label}</span>
                      <span className="vcheckdetail">{c.detail}</span>
                    </span>
                    <span className={`vcheckbadge ${c.level}`}>
                      {c.level === 'ok' ? 'PASS' : c.level === 'warn' ? 'WARN' : 'BLOCK'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="vfoot">
                <button className="btn" onClick={() => goStage(1)}>
                  <Icon name="back" size={15} /> Edit intake
                </button>
                <button
                  className="btn primary"
                  onClick={buildDossier}
                  disabled={!checksPass(checks)}
                  data-testid="build-dossier"
                >
                  <Icon name="doc" size={15} /> Build the PDF dossier
                </button>
                {!checksPass(checks) && (
                  <span className="sub" style={{ fontSize: 12 }}>
                    Clear the blocking items to continue.
                  </span>
                )}
              </div>
            </section>
          )}

          {stage === 3 && (
            <section className="vpanel">
              <div className="vpanelhead">
                <div>
                  <div className="h2">PDF dossier</div>
                  <div className="sub">
                    Print-ready pack: bio sheet, mission letter, itinerary, audit table, refusal defence.
                  </div>
                </div>
                <span style={{ flex: 1 }} />
                <button className="btn sm" onClick={() => active.artifactId && navigate(`/studio/${active.artifactId}`)}>
                  <Icon name="edit" size={14} /> Open in Studio
                </button>
                <button className="btn primary sm" onClick={downloadPdf} data-testid="download-pdf">
                  <Icon name="download" size={14} /> Download PDF
                </button>
              </div>
              <div className="vdossier">
                <Markdown text={dossierMarkdown(app, jur, checks, active.token)} />
              </div>
              <div className="vfoot">
                <button className="btn" onClick={() => goStage(2)}>
                  <Icon name="back" size={15} /> Checks
                </button>
                <button className="btn primary" onClick={goPortal} data-testid="to-portal">
                  Prepare portal payload <Icon name="arrowRight" size={15} />
                </button>
              </div>
            </section>
          )}

          {stage === 4 && (
            <section className="vpanel">
              <div className="vpanelhead">
                <div>
                  <div className="h2">Portal hand-off</div>
                  <div className="sub">
                    {jur.system} · {rows.length} fields mapped. Identity first, attachments last.
                  </div>
                </div>
                <span style={{ flex: 1 }} />
                <a className="btn sm" href={jur.portalUrl} target="_blank" rel="noreferrer">
                  <Icon name="globe" size={14} /> Open portal
                </a>
              </div>

              <div className="vmap">
                <div className="vmaphead">
                  <span>Portal field</span>
                  <span>Source</span>
                  <span>Value</span>
                </div>
                {jur.fields.map((f) => (
                  <div className="vmaprow" key={f.portal}>
                    <span className="vmapkey">{f.label}</span>
                    <span className="vmapsrc">{f.source}</span>
                    <span className="vmapval">{(portalPayload(app, jur)[f.portal] || '—').slice(0, 60)}</span>
                  </div>
                ))}
              </div>

              <div className="vfoot">
                <button className="btn" onClick={() => goStage(3)}>
                  <Icon name="back" size={15} /> Dossier
                </button>
                <button className="btn primary" onClick={startRun} data-testid="start-run">
                  <Icon name="browser" size={15} /> Start the live run
                </button>
              </div>
            </section>
          )}

          {stage >= 5 && (
            <section className="vpanel vpanel-live">
              <LiveScreen
                jurisdiction={jur}
                rows={rows}
                caseToken={active.token}
                applicantName={fullName(app)}
                autoStart={running && !active.run?.approvedAt}
                approvedReference={active.run?.reference}
                onHalt={onHalt}
                onFullscreen={() => undefined}
              />
              <div className="vfoot">
                <button className="btn" onClick={() => goStage(4)}>
                  <Icon name="back" size={15} /> Payload
                </button>
                {active.run?.approvedAt ? (
                  <button className="btn primary" onClick={downloadPdf}>
                    <Icon name="download" size={15} /> Download the filed dossier
                  </button>
                ) : (
                  <button className="btn" onClick={() => setReviewOpen(true)} data-testid="open-review">
                    <Icon name="shield" size={15} /> Staff review
                  </button>
                )}
              </div>
            </section>
          )}

          <div className="vlog">
            <div className="label">Run log</div>
            {active.log
              .slice()
              .reverse()
              .slice(0, 14)
              .map((l, i) => (
                <div className={`vlogrow ${l.level}`} key={i}>
                  <span className="vlogtime">
                    {new Date(l.at).toLocaleTimeString('en-GB', { hour12: false })}
                  </span>
                  <span>{l.text}</span>
                </div>
              ))}
          </div>
        </main>

        <aside className="visakb">
          <div className="kbcard">
            <div className="kbhead">
              <span style={{ fontSize: 20 }}>{jur.flag}</span>
              <div>
                <div style={{ fontWeight: 650 }}>{jur.country}</div>
                <div className="sub" style={{ fontSize: 12 }}>{jur.system}</div>
              </div>
            </div>
            <div className="kbrows">
              <div className="kbrow"><span>Form</span><b>{jur.form}</b></div>
              <div className="kbrow"><span>Fee</span><b>{jur.fee}</b></div>
              <div className="kbrow"><span>Processing</span><b>{jur.processing}</b></div>
              <div className="kbrow"><span>Validity</span><b>{jur.validityDaysBeyondStay} days beyond stay</b></div>
            </div>
            <div className="kbnote">{jur.notes}</div>
            <div className="label" style={{ marginTop: 10 }}>Requires</div>
            <ul className="kblist">
              {jur.requires.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="label" style={{ marginTop: 10 }}>Refusal grounds answered</div>
            <div className="kbclause">{jur.refusalClause}</div>
          </div>

          <div className="kbcard">
            <div className="label" style={{ margin: 0 }}>Skills in this pipeline · {SKILLS.length}</div>
            <div className="skilllist">
              {SKILLS.map((s) => {
                const open = skillOpen === s.id;
                return (
                  <div className={`skillrow${open ? ' open' : ''}`} key={s.id}>
                    <button className="skillhead" onClick={() => setSkillOpen(open ? null : s.id)}>
                      <Icon name={s.icon} size={15} />
                      <span className="skillname">{s.name}</span>
                      <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} />
                    </button>
                    {open && (
                      <div className="skillbody">
                        <p>{s.summary}</p>
                        <ol>
                          {s.steps.map((st) => (
                            <li key={st}>{st}</li>
                          ))}
                        </ol>
                        <div className="skillfoot">
                          <span className="badge">{s.agent}</span>
                          <span className="sub" style={{ fontSize: 11.5 }}>{s.output}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {reviewOpen && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setReviewOpen(false)}>
          <div className="modal vreview" role="dialog" aria-label="Staff review" data-testid="review-modal">
            <div className="modalhead">
              <div>
                <div className="h2">Staff review — final gate</div>
                <div className="sub">{active.token} · {jur.flag} {jur.country} · {jur.system}</div>
              </div>
              <span style={{ flex: 1 }} />
              <button className="iconbtn" onClick={() => setReviewOpen(false)} aria-label="Close">
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="modalbody vreviewbody">
              <div className="vrevcol">
                <div className="label">Verified passport data</div>
                <div className="vrevlist">
                  <div><span>Name</span><b>{fullName(app)}</b></div>
                  <div><span>Passport</span><b>{app.passportNo || '—'}</b></div>
                  <div><span>Nationality</span><b>{app.nationality || '—'}</b></div>
                  <div><span>Date of birth</span><b>{app.birthDate || '—'}</b></div>
                  <div><span>Expiry</span><b>{app.expiryDate || '—'}</b></div>
                  <div><span>Arrival</span><b>{app.arrival || '—'}</b></div>
                  <div><span>Departure</span><b>{app.departure || '—'}</b></div>
                  <div><span>Stay</span><b>{app.hotel || '—'}</b></div>
                </div>
              </div>
              <div className="vrevcol">
                <div className="label">Fields filled on the portal</div>
                <div className="vrevlist">
                  {rows.slice(0, 8).map((r) => (
                    <div key={r.portal}><span>{r.label}</span><b>{r.value || '—'}</b></div>
                  ))}
                  {rows.length > 8 && (
                    <div><span>Remaining</span><b>{rows.length - 8} fields</b></div>
                  )}
                </div>
              </div>
            </div>
            <div className="modalfoot">
              <span className="sub" style={{ fontSize: 12, marginRight: 'auto' }}>
                Submitting and paying happens only after this approval. Card data never enters the agent.
              </span>
              <button className="btn" onClick={() => setReviewOpen(false)}>Keep reviewing</button>
              <button className="btn primary" onClick={approve} data-testid="approve">
                <Icon name="check" size={15} /> Approve &amp; finalize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
