// ICAO 9303 TD3 (passport) MRZ parser with real check-digit verification.
// Nothing here is guessed: a wrong check digit is reported, not silently fixed.

import { MRZ_COUNTRIES } from './knowledge';

export interface MrzResult {
  ok: boolean;
  raw: string;
  lines: string[];
  passportNo: string;
  surname: string;
  givenNames: string;
  nationality: string;
  nationalityCode: string;
  birthDate: string;
  expiryDate: string;
  sex: 'M' | 'F' | 'X';
  documentCode: string;
  issues: { level: 'error' | 'warn'; text: string }[];
}

const CHAR_VALUE = (c: string): number => {
  if (c === '<' || c === ' ') return 0;
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
  return 0;
};

export function checkDigit(input: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i++) sum += CHAR_VALUE(input[i]) * weights[i % 3];
  return sum % 10;
}

function expandDate(yymmdd: string, kind: 'birth' | 'expiry'): string {
  if (!/^\d{6}$/.test(yymmdd)) return '';
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const nowYY = new Date().getFullYear() % 100;
  // Passports expire inside a 10-year window, so expiry is always 20xx here.
  const year = kind === 'expiry' ? 2000 + yy : yy > nowYY ? 1900 + yy : 2000 + yy;
  const mmNum = Number(mm);
  const ddNum = Number(dd);
  if (mmNum < 1 || mmNum > 12 || ddNum < 1 || ddNum > 31) return '';
  return `${year}-${mm}-${dd}`;
}

export function parseMrz(input: string): MrzResult {
  const compact = (input || '')
    .toUpperCase()
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 30);

  const issues: MrzResult['issues'] = [];
  const result: MrzResult = {
    ok: false,
    raw: '',
    lines: compact,
    passportNo: '',
    surname: '',
    givenNames: '',
    nationality: '',
    nationalityCode: '',
    birthDate: '',
    expiryDate: '',
    sex: 'X',
    documentCode: '',
    issues,
  };

  const l1 = compact.find((l) => /^P[<A-Z]/.test(l)) || compact[0] || '';
  const l2 = compact.find((l) => l !== l1 && /^[A-Z0-9<]{30,}$/.test(l)) || compact[1] || '';

  if (!l1 || !l2) {
    issues.push({ level: 'error', text: 'Two MRZ lines not found. Copy both lines from the bottom of the passport bio page.' });
    return result;
  }
  if (l1.length !== 44 || l2.length !== 44) {
    issues.push({
      level: 'warn',
      text: `MRZ lines are ${l1.length} and ${l2.length} characters; TD3 passports expect 44 each. Padding applied.`,
    });
  }

  const pad = (s: string) => (s + '<'.repeat(44)).slice(0, 44);
  const a = pad(l1);
  const b = pad(l2);

  result.documentCode = a.slice(0, 2).replace(/</g, '');
  const nameField = a.slice(5);
  const [surnamePart, givenPart = ''] = nameField.split('<<');
  const pretty = (s: string) => s.replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  result.surname = pretty(surnamePart);
  result.givenNames = pretty(givenPart);

  const passportNo = b.slice(0, 9);
  const passportCheck = b.slice(9, 10);
  const nationalityCode = b.slice(10, 13).replace(/</g, '');
  const dob = b.slice(13, 19);
  const dobCheck = b.slice(19, 20);
  const sex = b.slice(20, 21);
  const expiry = b.slice(21, 27);
  const expiryCheck = b.slice(27, 28);
  const personal = b.slice(28, 42);
  const personalCheck = b.slice(42, 43);
  const compositeCheck = b.slice(43, 44);

  result.passportNo = passportNo.replace(/</g, '');
  result.nationalityCode = nationalityCode;
  result.nationality = MRZ_COUNTRIES[nationalityCode] || '';
  result.birthDate = expandDate(dob, 'birth');
  result.expiryDate = expandDate(expiry, 'expiry');
  result.sex = sex === 'M' ? 'M' : sex === 'F' ? 'F' : 'X';

  const fail = (label: string, expected: number, got: string) =>
    issues.push({
      level: 'error',
      text: `${label} check digit is ${got || 'missing'}, computed ${expected}. Re-read that MRZ line.`,
    });

  if (/^\d+$/.test(passportCheck) && checkDigit(passportNo) !== Number(passportCheck)) {
    fail('Passport number', checkDigit(passportNo), passportCheck);
  }
  if (/^\d+$/.test(dobCheck) && checkDigit(dob) !== Number(dobCheck)) fail('Date of birth', checkDigit(dob), dobCheck);
  if (/^\d+$/.test(expiryCheck) && checkDigit(expiry) !== Number(expiryCheck))
    fail('Passport expiry', checkDigit(expiry), expiryCheck);
  if (/^\d+$/.test(personalCheck) && checkDigit(personal) !== Number(personalCheck))
    issues.push({ level: 'warn', text: 'Personal number check digit failed. Some passports leave this digit as 0.' });
  const composite = passportNo + passportCheck + dob + dobCheck + expiry + expiryCheck + personal + personalCheck;
  if (/^\d+$/.test(compositeCheck) && checkDigit(composite) !== Number(compositeCheck))
    fail('Composite', checkDigit(composite), compositeCheck);

  if (!result.surname) issues.push({ level: 'error', text: 'Surname could not be read from line 1.' });
  if (!result.passportNo) issues.push({ level: 'error', text: 'Passport number could not be read from line 2.' });
  if (!result.nationality) issues.push({ level: 'warn', text: `Country code ${nationalityCode || '???'} is not in the local country table. Pick it manually.` });

  result.raw = `${l1}\n${l2}`;
  result.ok = !issues.some((i) => i.level === 'error');

  if (result.expiryDate) {
    const days = Math.round((new Date(result.expiryDate).getTime() - Date.now()) / 86400000);
    if (days < 0) issues.push({ level: 'error', text: `Passport expired ${Math.abs(days)} days ago. No filing is possible.` });
    else if (days < 90) issues.push({ level: 'warn', text: `Passport expires in ${days} days. Most of the 8 jurisdictions require more.` });
  }

  return result;
}

/** A realistic sample so the pipeline can be demonstrated without a real passport. */
export const SAMPLE_MRZ = `P<BGDRAHMAN<<MOHAMMED<SAIFUL<ISLAM<<<<<<<<<<<<<<
BM09482169BGD8504124M3108192<<<<<<<<<<<<<<04`;
