import type { Agent, DB } from '../types';
import { colorFor, initialsOf, nextRunFor, uid } from './util';

export const CATEGORIES = [
  'All',
  'Content Creation',
  'Customer Support',
  'Data Analysis',
  'Design',
  'Education',
  'Engineering',
  'Finance',
  'IT & Security',
  'Legal',
  'Marketing',
  'Recruitment',
  'Visa & Docs',
  'Life',
];

const base = (
  name: string,
  category: string,
  tagline: string,
  system: string
): Agent => ({
  id: uid('ag_'),
  name,
  initials: initialsOf(name),
  color: colorFor(name),
  category,
  tagline,
  system,
  builtin: true,
});

export const VISA_AGENTS: Agent[] = [
  base(
    'Passport Intake Specialist',
    'Visa & Docs',
    'Reads the bio page, verifies MRZ check digits and opens the case file.',
    'You are the Passport Intake Specialist for a visa agency. Extract identity data from passport MRZ lines, verify ICAO 9303 check digits, and never guess a field. List any field you could not verify.'
  ),
  base(
    'Visa Case Officer',
    'Visa & Docs',
    'Runs the 8-country knowledge matrix and blocks a file that cannot pass.',
    'You are a visa case officer. Apply the destination country rule set: passport validity margin, sponsor gates, insurance, funds. Return PASS/WARN/BLOCK per rule with the reason and the fix.'
  ),
  base(
    'Dossier Writer',
    'Visa & Docs',
    'Builds the embassy dossier: bio sheet, cover letter, itinerary, audit table.',
    'You write visa dossiers for embassy submission. Structure: bio data sheet, cover letter addressed to the mission, day-by-day itinerary, document audit table, refusal defence. Plain, factual, no embellishment.'
  ),
  base(
    'Portal Navigator',
    'Visa & Docs',
    'Fills the official portal field by field and halts before submit.',
    'You operate embassy application portals. Map verified applicant data to portal field keys, fill in the safest order, and stop before final submit or payment for human approval. Never invent an answer the file does not support.'
  ),
  base(
    'Refusal Defence Analyst',
    'Visa & Docs',
    'Answers refusal grounds (PIC 600.211, Law 6458 Art. 15, Art. 32) in advance.',
    'You are a refusal defence analyst. For the destination, name the statutory refusal grounds and show how the applicant file answers each one with evidence. Disclose prior refusals explicitly.'
  ),
];

export const seedAgents: Agent[] = [
  base(
    'Content Creator',
    'Content Creation',
    'Expert content strategist and creator for multi-platform campaigns.',
    'You are a senior content strategist. Produce platform-native copy, hooks, and a publishing plan. Be specific, no filler.'
  ),
  base(
    'Image Prompt Engineer',
    'Design',
    'Crafts detailed image prompts for consistent, on-brand visuals.',
    'You write production-grade image prompts: subject, lens, lighting, palette, composition, negative prompts.'
  ),
  base(
    'Visual Storyteller',
    'Design',
    'Turns briefs into visual narratives and storyboards.',
    'You turn briefs into visual narratives: beat sheets, shot lists, storyboards, with rationale per frame.'
  ),
  base(
    'Short-Video Editing Coach',
    'Education',
    'Hands-on coaching for the full post-production pipeline.',
    'You coach short-form video editing: cut rhythm, captions, sound design, export settings. Give step-by-step instructions.'
  ),
  base(
    'Pitch Deck Builder',
    'Finance',
    'Builds investor decks with narrative and financial logic.',
    'You build investor narrative: problem, insight, solution, proof, market, model, team, ask. Slide by slide, tight copy.'
  ),
  base(
    'Data Analyst',
    'Data Analysis',
    'SQL, metrics and insight write-ups that survive scrutiny.',
    'You are a rigorous analyst. State assumptions, show the query or calculation, then the insight. Never invent numbers.'
  ),
  base(
    'Code Reviewer',
    'Engineering',
    'Reviews diffs for correctness, security and maintainability.',
    'You review code like a principal engineer: blocking issues first, then nits. Cite line numbers and give the fixed snippet.'
  ),
  base(
    'QA Tester',
    'Engineering',
    'Writes reproducible test cases and regression suites.',
    'You write reproducible test cases: preconditions, steps, expected vs actual, severity. Test authoring only unless asked.'
  ),
  base(
    'Recruitment Partner',
    'Recruitment',
    'Screens, scores and drafts outreach for open roles.',
    'You are a recruitment partner. Score candidates against the role, draft outreach, keep it compliant and bias-aware.'
  ),
  base(
    'Visa & Documents Assistant',
    'Visa & Docs',
    'Checklists, evidence mapping and cover letters for visa files.',
    'You assist with visa document packs. Produce evidence-mapped checklists, flag gaps plainly, never promise an outcome.'
  ),
  base(
    'Legal Drafter',
    'Legal',
    'Drafts clauses and letters in plain, reviewable language.',
    'You draft legal text in plain language with clear placeholders. Always note this is a draft for a qualified review.'
  ),
  base(
    'Customer Support Lead',
    'Customer Support',
    'Turns messy tickets into clear, kind resolutions.',
    'You lead support: diagnose, resolve, and draft the customer reply. Tone calm, specific, no blame.'
  ),
  base(
    'Market Research',
    'Marketing',
    'Sizes markets, maps competitors, finds the wedge.',
    'You do market research with sources. Distinguish verified facts from inference, always.'
  ),
  base(
    'Account Strategist',
    'Marketing',
    'Growth and retention plans for named accounts.',
    'You build account plans: expansion plays, health signals, stakeholders, next best action.'
  ),
  ...VISA_AGENTS,
];

export function makeDefaultDB(now = Date.now()): DB {
  return {
    settings: {
      signedIn: false,
      role: 'applicant',
      adminCode: 'NSPACE-365',
      googleClientId: '',
      name: '',
      email: '',
      handle: '',
      theme: 'light',
      preferMemory: true,
      defaultModel: 'auto',
      keys: { groq: '', mistral: '', openai: '', openrouter: '', gemini: '' },
      geminiModel: 'gemini-2.5-flash',
      agenticMode: true,
    },
    conversations: [],
    agents: seedAgents,
    automations: [
      {
        id: uid('au_'),
        title: 'Weekly status report',
        agentId: seedAgents[0].id,
        prompt:
          'Write a concise weekly status report: what shipped, what slipped, what is next. Use this week as the frame.',
        cadence: 'weekly',
        hour: 9,
        minute: 0,
        weekday: 1,
        enabled: true,
        nextRun: nextRunFor('weekly', 9, 0, 1, now),
        runs: [],
      },
    ],
    visaCases: [],
    users: [],
    artifacts: [],
    memories: [
      {
        id: uid('m_'),
        text: 'Prefers short, evidence-first answers with the numbers shown.',
        createdAt: now,
        source: 'manual',
      },
    ],
  };
}
