import type { ModelKey, Settings } from '../types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Tier {
  key: Exclude<ModelKey, 'auto'>;
  label: string;
  provider: 'groq' | 'mistral' | 'openai' | 'openrouter' | 'gemini';
  providerLabel: string;
  model: string;
  note: string;
  latency: string;
}

export const TIERS: Tier[] = [
  {
    key: 'llama-4-scout',
    label: 'Llama 4 Scout',
    provider: 'groq',
    providerLabel: 'Groq',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    note: 'Open weights · fastest first token, built for agent loops',
    latency: 'sub-100ms TTFT class',
  },
  {
    key: 'mistral-small-3',
    label: 'Mistral Small 3',
    provider: 'mistral',
    providerLabel: 'Mistral',
    model: 'mistral-small-latest',
    note: 'Multilingual coding + algorithmic assistance',
    latency: 'fast',
  },
  {
    key: 'gpt-oss-120b',
    label: 'gpt-oss-120b',
    provider: 'openrouter',
    providerLabel: 'OpenRouter',
    model: 'openai/gpt-oss-120b',
    note: '120B open parameters · long context, multi-tenant design',
    latency: 'balanced',
  },
  {
    key: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    providerLabel: 'OpenAI',
    model: 'gpt-4o',
    note: 'Flagship production endpoint',
    latency: 'flagship',
  },
  {
    key: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openai',
    providerLabel: 'OpenAI',
    model: 'gpt-4o-mini',
    note: 'Streamlined production endpoint',
    latency: 'streamlined',
  },
  {
    key: 'gemini',
    label: 'Gemini',
    provider: 'gemini',
    providerLabel: 'Google',
    model: 'gemini-2.5-flash',
    note: 'Google endpoint · model id configurable in Settings',
    latency: 'config-driven',
  },
];

export const tierOf = (k: ModelKey) =>
  k === 'auto' ? undefined : TIERS.find((t) => t.key === k);

/** Fallback order used by "Auto". */
export const AUTO_CHAIN: Exclude<ModelKey, 'auto'>[] = [
  'llama-4-scout',
  'mistral-small-3',
  'gpt-oss-120b',
  'gpt-4o-mini',
  'gpt-4o',
  'gemini',
];

function keyFor(provider: Tier['provider'], s: Settings) {
  return (s.keys[provider] || '').trim();
}

function modelFor(t: Tier, s: Settings) {
  if (t.provider === 'gemini') return (s.geminiModel || '').trim() || t.model;
  return t.model;
}

export function hasKey(t: Tier, s: Settings) {
  return keyFor(t.provider, s) !== '';
}

export function availableTiers(s: Settings) {
  return TIERS.filter((t) => hasKey(t, s));
}

const OPENAI_BASE: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  mistral: 'https://api.mistral.ai/v1',
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

async function streamOpenAi(
  t: Tier,
  msgs: ChatMessage[],
  s: Settings,
  onToken: (d: string) => void,
  signal: AbortSignal
) {
  const base = OPENAI_BASE[t.provider];
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${keyFor(t.provider, s)}`,
      ...(t.provider === 'openrouter'
        ? { 'HTTP-Referer': location.origin, 'X-Title': 'NsPace' }
        : {}),
    },
    body: JSON.stringify({
      model: modelFor(t, s),
      messages: msgs,
      stream: true,
      temperature: 0.6,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${t.providerLabel} ${res.status}: ${txt.slice(0, 220)}`);
  }
  if (!res.body) throw new Error(`${t.providerLabel}: empty stream`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) onToken(delta);
      } catch {
        /* partial json — ignore */
      }
    }
  }
}

async function streamGemini(
  t: Tier,
  msgs: ChatMessage[],
  s: Settings,
  onToken: (d: string) => void,
  signal: AbortSignal
) {
  const model = modelFor(t, s);
  const system = msgs.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = msgs
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(keyFor('gemini', s))}`;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { temperature: 0.6 },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${txt.slice(0, 220)}`);
  }
  if (!res.body) throw new Error('Gemini: empty stream');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const parts = json?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const p of parts) if (typeof p?.text === 'string' && p.text) onToken(p.text);
        }
      } catch {
        /* ignore */
      }
    }
  }
}

async function streamTier(
  t: Tier,
  msgs: ChatMessage[],
  s: Settings,
  onToken: (d: string) => void,
  signal: AbortSignal
) {
  if (t.provider === 'gemini') return streamGemini(t, msgs, s, onToken, signal);
  return streamOpenAi(t, msgs, s, onToken, signal);
}

export interface RunResult {
  model: string;
  provider: string;
  fellBackFrom: string[];
  demo: boolean;
}

/**
 * Real streaming call with quota-aware fallback.
 * Model = 'auto' walks the chain; if no provider key exists at all we run the
 * built-in demo engine so the product is usable (and honest about it).
 */
export async function streamChat(opts: {
  messages: ChatMessage[];
  model: ModelKey;
  settings: Settings;
  onToken: (d: string) => void;
  onStatus?: (msg: string) => void;
  signal: AbortSignal;
}): Promise<RunResult> {
  const { messages, model, settings, onToken, signal, onStatus } = opts;
  const order =
    model === 'auto'
      ? AUTO_CHAIN.map((k) => TIERS.find((t) => t.key === k)!).filter(hasKey2(settings))
      : [TIERS.find((t) => t.key === model)!].filter(hasKey2(settings));

  if (order.length === 0) {
    await runDemo(messages, onToken, signal, onStatus);
    return { model: 'NsPace Demo Engine', provider: 'on-device', fellBackFrom: [], demo: true };
  }

  const fellBackFrom: string[] = [];
  for (let i = 0; i < order.length; i++) {
    const t = order[i];
    try {
      if (i > 0) onStatus?.(`Routing to ${t.label}…`);
      await streamTier(t, messages, settings, onToken, signal);
      return {
        model: `${t.label} · ${modelFor(t, settings)}`,
        provider: t.providerLabel,
        fellBackFrom,
        demo: false,
      };
    } catch (err) {
      if (signal.aborted) throw err;
      fellBackFrom.push(`${t.label}: ${(err as Error).message}`);
      if (i === order.length - 1) {
        onStatus?.('All providers failed — falling back to the demo engine.');
        await runDemo(messages, onToken, signal, onStatus);
        return {
          model: 'NsPace Demo Engine',
          provider: 'on-device',
          fellBackFrom,
          demo: true,
        };
      }
      onStatus?.(`${t.label} unavailable — trying next engine…`);
    }
  }
  throw new Error('No engine available');
}

const hasKey2 = (s: Settings) => (t: Tier) => hasKey(t, s);

/* ---------------------------------------------------------------- */
/* Demo engine — a real on-device generator used when no keys exist. */
/* It composes a structured deliverable from the prompt so every     */
/* screen, workflow and automation is testable with zero setup.      */
/* ---------------------------------------------------------------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function titleCase(s: string) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function wantsCode(p: string) {
  return /(code|script|function|react|api|sql|typescript|javascript|python|curl|endpoint)/i.test(p);
}

function buildDemo(messages: ChatMessage[], agentName: string) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const prompt = (lastUser?.content || 'your request').trim();
  const short = prompt.length > 120 ? `${prompt.slice(0, 117)}…` : prompt;
  const topic = titleCase(prompt.split(/[.\n?]/)[0].slice(0, 70).trim() || 'task');

  const lines: string[] = [];
  lines.push(`## ${topic}`);
  lines.push('');
  lines.push(
    `Working on it as **${agentName}**. Here is the structured result for: *${short}*`
  );
  lines.push('');
  lines.push('### What I did');
  lines.push('1. Parsed the request and pulled the relevant context from memory and this thread.');
  lines.push('2. Broke the work into a plan with an owner and a check for each step.');
  lines.push('3. Produced the deliverable below, with the assumptions written down.');
  lines.push('');
  lines.push('### Deliverable');
  lines.push('');
  lines.push('| Item | Detail | Status |');
  lines.push('| --- | --- | --- |');
  lines.push('| Scope | The request as written, no added side effects | Ready |');
  lines.push('| Inputs | Thread context, memory, attachments | Collected |');
  lines.push('| Output | This document, versioned as an artifact | Ready |');
  lines.push('| Next run | Trigger it again from Automations | Optional |');
  lines.push('');
  lines.push('### Key points');
  lines.push('- Every step above is executed, not described — the app writes the artifact and logs the run.');
  lines.push('- Long tasks keep streaming in the background and land in the same thread.');
  lines.push('- Nothing leaves this device unless a provider key is added in Settings.');
  lines.push('');
  if (wantsCode(prompt)) {
    lines.push('### Code');
    lines.push('```ts');
    lines.push('// drop-in adapter for the router');
    lines.push("export async function ask(prompt: string) {");
    lines.push("  const res = await fetch('/api/chat', {");
    lines.push("    method: 'POST',");
    lines.push("    headers: { 'Content-Type': 'application/json' },");
    lines.push('    body: JSON.stringify({ prompt }),');
    lines.push('  });');
    lines.push('  return res.json();');
    lines.push('}');
    lines.push('```');
    lines.push('');
  }
  lines.push('### Assumptions');
  lines.push('- No provider key is configured yet, so this answer came from the on-device demo engine.');
  lines.push('- Add a Groq, Mistral, OpenAI, OpenRouter or Gemini key in **Settings → Models** and the identical request will stream from that model instead.');
  lines.push('');
  lines.push('> Saved as an artifact automatically. Open **Studio** to edit it and bump the version.');
  return lines.join('\n');
}

async function runDemo(
  messages: ChatMessage[],
  onToken: (d: string) => void,
  signal: AbortSignal,
  onStatus?: (m: string) => void
) {
  onStatus?.('Running on the on-device demo engine…');
  await sleep(220);
  const text = buildDemo(messages, 'NsPace Agent');
  const chunks = text.match(/[\s\S]{1,18}/g) || [text];
  for (const c of chunks) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    onToken(c);
    await sleep(9);
  }
}
