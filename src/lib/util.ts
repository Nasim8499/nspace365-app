import type { Cadence } from '../types';

export const uid = (p = '') =>
  p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const cls = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export const dayMs = 86400000;

export function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], {
    month: '2-digit',
    day: '2-digit',
    ...(sameYear ? {} : { year: '2-digit' }),
  });
}

export function relTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < dayMs) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 7 * dayMs) return `${Math.floor(diff / dayMs)}d ago`;
  return fmtDate(ts);
}

export function fmtDateTime(ts: number) {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const PALETTE = [
  'linear-gradient(135deg,#0A84FF,#5E5CE6)',
  'linear-gradient(135deg,#34C759,#0A84FF)',
  'linear-gradient(135deg,#FF9500,#FF3B30)',
  'linear-gradient(135deg,#BF5AF2,#5E5CE6)',
  'linear-gradient(135deg,#5AC8FA,#007AFF)',
  'linear-gradient(135deg,#FF2D55,#FF9500)',
  'linear-gradient(135deg,#30D158,#5E5CE6)',
  'linear-gradient(135deg,#64D2FF,#BF5AF2)',
];

export function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      el.remove();
    }
  }
}

export function downloadText(filename: string, text: string, mime = 'text/markdown') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9\u0980-\u09FF]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled'
  );
}

/** Next fire time for a cadence. */
export function nextRunFor(
  cadence: Cadence,
  hour: number,
  minute: number,
  weekday: number,
  from = Date.now()
): number {
  const d = new Date(from);
  d.setSeconds(0, 0);
  const target = new Date(d);
  target.setHours(hour, minute, 0, 0);

  if (cadence === 'hourly') {
    const n = new Date(d);
    n.setMinutes(minute, 0, 0);
    if (n.getTime() <= from) n.setHours(n.getHours() + 1);
    return n.getTime();
  }
  if (cadence === 'daily') {
    if (target.getTime() <= from) target.setDate(target.getDate() + 1);
    return target.getTime();
  }
  if (cadence === 'weekly') {
    const diff = (weekday - target.getDay() + 7) % 7;
    target.setDate(target.getDate() + diff);
    if (target.getTime() <= from) target.setDate(target.getDate() + 7);
    return target.getTime();
  }
  // monthly
  target.setDate(1);
  if (target.getTime() <= from) target.setMonth(target.getMonth() + 1);
  return target.getTime();
}

export function cadenceLabel(c: Cadence, hour: number, minute: number, weekday: number) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday];
  if (c === 'hourly') return `Hourly at :${mm}`;
  if (c === 'daily') return `Daily at ${hh}:${mm}`;
  if (c === 'weekly') return `Weekly on ${wd} at ${hh}:${mm}`;
  return `Monthly on the 1st at ${hh}:${mm}`;
}

export function clip(text: string, max: number) {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,.;:]$/, '') + '…';
}

export function countWords(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function estimateTokens(s: string) {
  return Math.max(0, Math.round(s.length / 4));
}
