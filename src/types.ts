export type Role = 'user' | 'assistant';

export type ModelKey =
  | 'auto'
  | 'llama-4-scout'
  | 'mistral-small-3'
  | 'gpt-oss-120b'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gemini';

export interface Attachment {
  name: string;
  size: number;
  mime: string;
  text?: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  model?: string;
  streaming?: boolean;
  error?: boolean;
  feedback?: 'up' | 'down' | null;
  artifactId?: string;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  title: string;
  agentId: string;
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

export interface Agent {
  id: string;
  name: string;
  initials: string;
  color: string;
  category: string;
  tagline: string;
  system: string;
  builtin?: boolean;
  model?: ModelKey;
}

export interface AutoRun {
  id: string;
  at: number;
  status: 'ok' | 'error';
  summary: string;
  artifactId?: string;
}

export type Cadence = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface Automation {
  id: string;
  title: string;
  agentId: string;
  prompt: string;
  cadence: Cadence;
  hour: number;
  minute: number;
  weekday: number;
  enabled: boolean;
  lastRun?: number;
  nextRun: number;
  runs: AutoRun[];
}

export interface Artifact {
  id: string;
  title: string;
  kind: 'markdown' | 'html';
  body: string;
  version: number;
  updatedAt: number;
  createdAt: number;
  folder: string;
  agentId?: string;
  conversationId?: string;
  saved?: boolean;
  tags: string[];
}

export interface MemoryItem {
  id: string;
  text: string;
  createdAt: number;
  source: 'manual' | 'chat';
}

export interface AppUser {
  email: string;
  name: string;
  role: 'applicant' | 'admin';
  createdAt: number;
  /** Password for manually created accounts (stored on this device only). */
  pw?: string;
  /** false until the emailed sign-up link is opened; accounts without a link are legacy and count as verified. */
  verified?: boolean;
  /** one-time token carried by the verification link. */
  token?: string;
}

export interface Settings {
  signedIn: boolean;
  role: 'applicant' | 'admin';
  adminCode: string;
  googleClientId: string;
  name: string;
  email: string;
  handle: string;
  theme: 'light' | 'dark';
  preferMemory: boolean;
  defaultModel: ModelKey;
  keys: {
    groq: string;
    mistral: string;
    openai: string;
    openrouter: string;
    gemini: string;
  };
  geminiModel: string;
  agenticMode: boolean;
}

import type { VisaCase } from './lib/dossier';

export interface DB {
  settings: Settings;
  conversations: Conversation[];
  agents: Agent[];
  automations: Automation[];
  artifacts: Artifact[];
  memories: MemoryItem[];
  visaCases: VisaCase[];
  users: AppUser[];
}
