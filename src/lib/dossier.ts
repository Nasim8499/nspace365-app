import type { Jurisdiction } from './knowledge';
import type { MrzResult } from './mrz';
import type { PdfBlock, PdfDoc } from './pdf';

export interface Applicant {
  surname: string;
  givenNames: string;
  passportNo: string;
  nationality: string;
  birthDate: string;
  expiryDate: string;
  sex: 'M' | 'F' | 'X';
  placeOfBirth: string;
  email: string;
  phone: string;
  address: string;
  hotel: string;
  arrival: string;
  departure: string;
  purpose: string;
  occupation: string;
  employer: string;
  funds: string;
  insurance: string;
  sponsor: string;
  photoName: string;
  previousRefusal: string;
}

export type CheckLevel = 'ok' | 'warn' | 'fail';

export interface Check {
  id: string;
  label: string;
  level: CheckLevel;
  detail: string;
}

export interface CaseDoc {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: number;
  note?: string;
  kind: 'passport' | 'bank' | 'employment' | 'itinerary' | 'insurance' | 'other';
}

export interface VisaCase {
  id: string;
  owner: string;
  docs: CaseDoc[];
  token: string;
  country: string;
  applicant: Applicant;
  mrz?: string;
  mrzOk?: boolean;
  checks: Check[];
  stage: number;
  dossierAt?: number;
  artifactId?: string;
  payload?: Record<string, string>;
  run?: {
    startedAt: number;
    haltedAt?: number;
    approvedAt?: number;
    reference?: string;
    fieldCount: number;
  };
  log: { at: number; text: string; level: 'info' | 'ok' | 'warn' | 'error' }[];
  createdAt: number;
  updatedAt: number;
}

export const emptyApplicant = (): Applicant => ({
  surname: '',
  givenNames: '',
  passportNo: '',
  nationality: '',
  birthDate: '',
  expiryDate: '',
  sex: 'X',
  placeOfBirth: '',
  email: '',
  phone: '',
  address: '',
  hotel: '',
  arrival: '',
  departure: '',
  purpose: 'Tourism',
  occupation: '',
  employer: '',
  funds: '',
  insurance: '',
  sponsor: '',
  photoName: '',
  previousRefusal: '',
});

export const fullName = (a: Applicant) =>
  `${a.givenNames} ${a.surname}`.replace(/\s+/g, ' ').trim() || 'Applicant';

export const applyMrz = (a: Applicant, m: MrzResult): Applicant => ({
  ...a,
  surname: m.surname || a.surname,
  givenNames: m.givenNames || a.givenNames,
  passportNo: m.passportNo || a.passportNo,
  nationality: m.nationality || a.nationality,
  birthDate: m.birthDate || a.birthDate,
  expiryDate: m.expiryDate || a.expiryDate,
  sex: m.sex,
});

const DAY = 86400000;
const days = (from: string, to: string) =>
  from && to ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY) : NaN;

export const minFundsPerDay: Record<string, number> = {
  AU: 60,
  TR: 50,
  RS: 60,
  RU: 50,
  SG: 80,
  MY: 50,
  SA: 70,
  BH: 70,
};

export function runChecks(a: Applicant, j: Jurisdiction, mrz?: MrzResult): Check[] {
  const checks: Check[] = [];

  if (mrz) {
    checks.push({
      id: 'mrz',
      label: 'MRZ parsed with check digits',
      level: mrz.ok ? 'ok' : 'fail',
      detail: mrz.ok
        ? `Passport ${mrz.passportNo || '—'} · ${mrz.surname || '—'} verified against ICAO 9303 check digits.`
        : mrz.issues.find((i) => i.level === 'error')?.text || 'MRZ could not be verified.',
    });
  } else {
    checks.push({
      id: 'mrz',
      label: 'MRZ parsed with check digits',
      level: 'warn',
      detail: 'No MRZ supplied. Fields are manual, so the passport page must be checked by a human.',
    });
  }

  const expiryGap = days(a.departure || new Date().toISOString().slice(0, 10), a.expiryDate);
  const expired = a.expiryDate ? days(new Date().toISOString().slice(0, 10), a.expiryDate) : NaN;
  checks.push({
    id: 'validity',
    label: `Passport validity: ${j.validityRule}`,
    level: !a.expiryDate
      ? 'fail'
      : expired <= 0
        ? 'fail'
        : expiryGap >= j.validityDaysBeyondStay
          ? 'ok'
          : j.validityDaysBeyondStay === 0
            ? 'warn'
            : 'fail',
    detail: !a.expiryDate
      ? 'Passport expiry date is missing.'
      : expired <= 0
        ? 'Passport is expired.'
        : `${expiryGap} days of validity past the planned departure (${j.validityDaysBeyondStay} required for ${j.country}).`,
  });

  const nights = days(a.arrival, a.departure);
  checks.push({
    id: 'dates',
    label: 'Trip dates are coherent',
    level: Number.isFinite(nights) && nights > 0 && nights <= 90 ? 'ok' : 'fail',
    detail: Number.isFinite(nights)
      ? nights > 0
        ? `${nights} nights, ${a.arrival} → ${a.departure}.`
        : 'Departure is before arrival.'
      : 'Arrival and departure dates are required.',
  });

  const identity = [a.surname, a.givenNames, a.passportNo, a.nationality, a.birthDate].filter(Boolean).length;
  checks.push({
    id: 'identity',
    label: 'Applicant identity complete',
    level: identity === 5 ? 'ok' : identity >= 3 ? 'warn' : 'fail',
    detail: `${identity} of 5 core identity fields captured.`,
  });

  const contact = [a.email, a.phone, a.address].filter(Boolean).length;
  checks.push({
    id: 'contact',
    label: 'Contact block complete',
    level: contact === 3 ? 'ok' : contact >= 1 ? 'warn' : 'fail',
    detail: `${contact} of 3 contact fields captured (email, mobile, residential address).`,
  });

  checks.push({
    id: 'stay',
    label: 'Accommodation named in destination',
    level: a.hotel ? 'ok' : 'fail',
    detail: a.hotel || 'Hotel or host address is required by every portal in the matrix.',
  });

  const funds = Number((a.funds || '').replace(/[^0-9.]/g, ''));
  const needed = minFundsPerDay[j.code] * Math.max(nights || 0, 1);
  checks.push({
    id: 'funds',
    label: 'Funds evidence covers the stay',
    level: !funds ? 'warn' : funds >= needed ? 'ok' : 'warn',
    detail: funds
      ? `USD ${funds.toLocaleString()} declared, USD ${needed.toLocaleString()} indicated at ~$${minFundsPerDay[j.code]}/day.`
      : 'No funds figure entered. Add a bank balance to strengthen the file.',
  });

  if (j.requires.some((r) => /insurance/i.test(r))) {
    checks.push({
      id: 'insurance',
      label: 'Travel medical insurance on file',
      level: a.insurance ? 'ok' : 'warn',
      detail: a.insurance || `Required: ${j.requires.find((r) => /insurance/i.test(r))}`,
    });
  }

  if (j.sponsor) {
    checks.push({
      id: 'sponsor',
      label: 'Local sponsor (Form V39A) secured',
      level: a.sponsor ? 'ok' : 'fail',
      detail: a.sponsor || j.sponsor,
    });
  }

  checks.push({
    id: 'photo',
    label: 'Passport scan / photo attached',
    level: a.photoName ? 'ok' : 'warn',
    detail: a.photoName || 'Attach the bio page scan so the dossier carries the source image.',
  });

  if (a.previousRefusal) {
    checks.push({
      id: 'refusal',
      label: 'Previous refusal disclosed',
      level: 'warn',
      detail: a.previousRefusal,
    });
  }

  return checks;
}

export const checksPass = (checks: Check[]) => !checks.some((c) => c.level === 'fail');

export function token(country: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let body = '';
  for (let i = 0; i < 6; i++) body += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `VM-${String(new Date().getFullYear()).slice(2)}-${country}-${body}`;
}

const fmt = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function itinerary(a: Applicant): string[] {
  const start = a.arrival ? new Date(a.arrival) : null;
  const end = a.departure ? new Date(a.departure) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return ['Arrival and departure dates are needed to build the day-by-day plan.'];
  }
  const out: string[] = [];
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));
  for (let i = 0; i <= total; i++) {
    const d = new Date(start.getTime() + i * DAY);
    const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
    if (i === 0) out.push(`${label} — Depart Dhaka, arrive ${a.hotel || 'destination'}. Hotel check-in, rest, no business activity.`);
    else if (i === total) out.push(`${label} — Check out, transfer to airport, return flight to Bangladesh.`);
    else if (i === 1)
      out.push(`${label} — ${a.purpose === 'Business meetings' ? 'Morning meeting with the local partner, afternoon site visit.' : 'City orientation and embassy/document errands.'} Dinner at the hotel.`);
    else if (i % 3 === 0)
      out.push(`${label} — ${a.purpose === 'Business meetings' ? 'Follow-up meetings and contract review with local counsel.' : 'Planned excursion, returning to the hotel each night.'}`);
    else out.push(`${label} — ${a.purpose === 'Business meetings' ? 'Working session at the hotel business centre.' : 'Leisure day based at the hotel, receipts retained.'}`);
  }
  return out;
}

export function dossierMarkdown(
  a: Applicant,
  j: Jurisdiction,
  checks: Check[],
  caseToken: string,
  agency = 'VisaMOTion 365'
): string {
  const pass = checks.filter((c) => c.level === 'ok').length;
  const warns = checks.filter((c) => c.level === 'warn').length;
  const fails = checks.filter((c) => c.level === 'fail').length;

  return `# Visa application dossier — ${j.country} ${j.flag}

**Tracking token:** \`${caseToken}\`  
**Prepared by:** ${agency} · NsPace Visa Automate  
**Jurisdiction:** ${j.portal}  
**Form:** ${j.form}  
**Generated:** ${new Date().toLocaleString('en-GB')}  
**Audit:** ${pass} passed · ${warns} warnings · ${fails} blocking

## 1. Applicant bio data sheet

| Field | Value |
| --- | --- |
| Full name | ${fullName(a)} |
| Passport number | ${a.passportNo || '—'} |
| Nationality | ${a.nationality || '—'} |
| Date of birth | ${fmt(a.birthDate)} |
| Sex | ${a.sex === 'X' ? 'Unspecified' : a.sex} |
| Passport expiry | ${fmt(a.expiryDate)} |
| Place of birth | ${a.placeOfBirth || '—'} |
| Occupation | ${a.occupation || '—'} |
| Employer | ${a.employer || '—'} |
| Email | ${a.email || '—'} |
| Mobile | ${a.phone || '—'} |
| Residential address | ${a.address || '—'} |

## 2. Cover letter to the diplomatic mission

To: The Visa Officer, ${j.portal}
Subject: ${a.purpose} visa application — ${fullName(a)} — passport ${a.passportNo || '—'}

Dear Sir or Madam,

I am writing on behalf of ${fullName(a)}, a national of ${a.nationality || 'Bangladesh'}, who intends to travel to ${j.country} from ${fmt(a.arrival)} to ${fmt(a.departure)} for ${a.purpose.toLowerCase()}. The applicant is ${a.occupation ? `employed as ${a.occupation}${a.employer ? ` at ${a.employer}` : ''}` : 'engaged in steady employment in the home country'} and returns to ${a.address || 'the home address on file'} at the end of the visit.

The purpose of the trip is fully documented: a confirmed hotel at ${a.hotel || 'the stated accommodation'}, a return booking on the declared departure date, and funds of ${a.funds ? `USD ${a.funds}` : 'a bank balance that covers the stay'} available for the journey. All documents listed in the embassy checklist are enclosed in this dossier.

The applicant holds a ${a.nationality || 'valid'} passport numbered ${a.passportNo || '—'}, expiring ${fmt(a.expiryDate)}. This satisfies the ${j.country} requirement that the passport remain valid for at least ${j.validityDaysBeyondStay || 0} days beyond the planned departure.

I confirm that the information and documents enclosed are genuine. Should any clarification be required, the applicant is reachable at ${a.phone || 'the mobile number on file'} or ${a.email || 'the email on file'}.

Yours faithfully,
${fullName(a)}
Passport ${a.passportNo || '—'}
Prepared with NsPace Visa Automate · ${agency} · token ${caseToken}

## 3. Day-by-day travel plan

${itinerary(a)
  .map((line) => `- ${line}`)
  .join('\n')}

## 4. ${j.country} requirements and how this file meets them

| Requirement | Status |
| --- | --- |
${j.requires.map((r) => `| ${r} | Provided in dossier section 1-3 / attachments |`).join('\n')}

${j.sponsor ? `**Local sponsor gate:** ${j.sponsor}\n` : ''}
**Portal note:** ${j.notes}

## 5. Refusal defence — ${j.refusalClause}

${j.refusalDefence.map((line, i) => `${i + 1}. ${line}`).join('\n')}

## 6. Document audit checklist

| Check | Result | Detail |
| --- | --- | --- |
${checks.map((c) => `| ${c.label} | ${c.level === 'ok' ? 'PASS' : c.level === 'warn' ? 'WARN' : 'BLOCK'} | ${c.detail.replace(/\|/g, '/')} |`).join('\n')}

${a.previousRefusal ? `## 7. Disclosure\n\n${a.previousRefusal}\n` : ''}
---

*Generated by NsPace Visa Automate. Portal rules, fees and processing times change; confirm each item on ${j.portalUrl} before filing. This dossier is a prepared submission pack, not legal advice.*
`;
}

export function dossierPdf(
  a: Applicant,
  j: Jurisdiction,
  checks: Check[],
  caseToken: string,
  agency = 'VisaMOTion 365'
): PdfDoc {
  const blocks: PdfBlock[] = [
    { type: 'p', text: `Tracking token ${caseToken} · prepared ${new Date().toLocaleString('en-GB')} by ${agency} with NsPace Visa Automate.` },
    { type: 'h1', text: '1. Applicant bio data' },
    {
      type: 'kv',
      pairs: [
        ['Full name', fullName(a)],
        ['Passport', `${a.passportNo || '—'} (${a.nationality || '—'})`],
        ['Date of birth', fmt(a.birthDate)],
        ['Sex', a.sex === 'X' ? 'Unspecified' : a.sex],
        ['Passport expiry', fmt(a.expiryDate)],
        ['Occupation', a.occupation || '—'],
        ['Employer', a.employer || '—'],
        ['Email', a.email || '—'],
        ['Mobile', a.phone || '—'],
        ['Address', a.address || '—'],
        ['Travel dates', `${fmt(a.arrival)} to ${fmt(a.departure)}`],
        ['Accommodation', a.hotel || '—'],
        ['Purpose', a.purpose],
        ['Funds', a.funds ? `USD ${a.funds}` : '—'],
      ],
    },
    { type: 'h1', text: '2. Cover letter' },
    {
      type: 'p',
      text: `To: The Visa Officer, ${j.portal}. Subject: ${a.purpose} visa application for ${fullName(a)}, passport ${a.passportNo || '—'}.`,
    },
    {
      type: 'p',
      text: `Dear Sir or Madam, I am writing on behalf of ${fullName(a)}, a national of ${a.nationality || 'Bangladesh'}, who intends to travel to ${j.country} from ${fmt(a.arrival)} to ${fmt(a.departure)} for ${a.purpose.toLowerCase()}. The applicant is ${a.occupation ? `employed as ${a.occupation}${a.employer ? ` at ${a.employer}` : ''}` : 'in steady employment in the home country'} and returns to ${a.address || 'the home address on file'} after the visit.`,
    },
    {
      type: 'p',
      text: `The trip is documented end to end: a confirmed stay at ${a.hotel || 'the declared accommodation'}, a return booking on ${fmt(a.departure)}, and ${a.funds ? `USD ${a.funds}` : 'sufficient'} funds covering the journey. The passport expires ${fmt(a.expiryDate)}, which satisfies the ${j.country} validity requirement of ${j.validityDaysBeyondStay} days beyond departure. All documents on the embassy checklist are enclosed.`,
    },
    { type: 'p', text: `${fullName(a)} · ${a.phone || 'mobile on file'} · ${a.email || 'email on file'} · prepared with NsPace Visa Automate.` },
    { type: 'h1', text: '3. Day-by-day travel plan' },
    { type: 'bullet', items: itinerary(a) },
    { type: 'h1', text: `4. ${j.country} portal notes` },
    { type: 'bullet', items: [j.notes, j.sponsor || `Form: ${j.form}`, `Fee: ${j.fee} · Processing: ${j.processing}`] },
    { type: 'h1', text: `5. Refusal defence (${j.refusalClause})` },
    { type: 'bullet', items: j.refusalDefence },
    { type: 'h1', text: '6. Document audit' },
    {
      type: 'table',
      head: ['Check', 'Result', 'Detail'],
      rows: checks.map((c) => [c.label, c.level === 'ok' ? 'PASS' : c.level === 'warn' ? 'WARN' : 'BLOCK', c.detail]),
    },
    { type: 'rule' },
    {
      type: 'p',
      text: `Portal rules, fees and processing times change. Confirm each item on ${j.portalUrl} before filing. This dossier is a prepared submission pack, not legal advice.`,
    },
  ];

  return {
    title: `${j.country} visa dossier`,
    subtitle: `${fullName(a)} · passport ${a.passportNo || '—'} · ${caseToken}`,
    footer: `NsPace Visa Automate · ${caseToken}`,
    blocks,
  };
}

export function portalPayload(a: Applicant, j: Jurisdiction): Record<string, string> {
  const source: Record<string, string> = {
    surname: a.surname,
    givenNames: a.givenNames,
    fullName: fullName(a),
    passportNo: a.passportNo,
    nationality: a.nationality,
    birthDate: a.birthDate,
    expiryDate: a.expiryDate,
    sex: a.sex,
    placeOfBirth: a.placeOfBirth,
    email: a.email,
    phone: a.phone,
    address: a.address,
    hotel: a.hotel,
    arrival: a.arrival,
    departure: a.departure,
    purpose: a.purpose,
    occupation: a.occupation,
    employer: a.employer,
    funds: a.funds,
    insurance: a.insurance,
    sponsor: a.sponsor,
    photo: a.photoName,
  };
  const payload: Record<string, string> = {};
  j.fields.forEach((f) => {
    const v = source[f.source] || '';
    payload[f.portal] = f.type === 'select' && f.options?.length && !v ? f.options[0] : v;
  });
  return payload;
}
