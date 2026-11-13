// Built-in skills shipped with NsPace. The Visa Automate pipeline is assembled
// from these; each skill is a real function in the app, not a label.

export interface Skill {
  id: string;
  name: string;
  icon: string;
  category: 'Visa intent' | 'Documents' | 'Portal' | 'Guardrails' | 'General';
  summary: string;
  steps: string[];
  output: string;
  agent: string;
}

export const SKILLS: Skill[] = [
  {
    id: 'passport-mrz',
    name: 'Passport MRZ Reader',
    icon: 'scan',
    category: 'Visa intent',
    summary: 'Parses TD3 MRZ lines and verifies every ICAO 9303 check digit before any field is trusted.',
    steps: [
      'Normalise the two MRZ lines from the bio page',
      'Split surname / given names on the << separator',
      'Verify passport number, date of birth, expiry and composite check digits',
      'Map the ISO alpha-3 country code to a nationality',
      'Flag expired or short-validity passports before intake continues',
    ],
    output: 'Verified identity block + issue list',
    agent: 'Passport Intake Specialist',
  },
  {
    id: 'kb-validate',
    name: 'Knowledge Base Validator',
    icon: 'brain',
    category: 'Visa intent',
    summary: 'Checks the file against the 8-country matrix: validity margins, sponsor gates, insurance and funds.',
    steps: [
      'Load the jurisdiction rule set (validity, sponsor, insurance, funds floor)',
      'Compare passport expiry with the planned departure date',
      'Apply sponsor gates such as Singapore Form V39A',
      'Score funds against the per-day threshold and stay length',
      'Return PASS / WARN / BLOCK per rule',
    ],
    output: 'Rule verdicts with reasons',
    agent: 'Visa Case Officer',
  },
  {
    id: 'dossier-composer',
    name: 'Dossier Composer',
    icon: 'doc',
    category: 'Documents',
    summary: 'Builds the print-ready PDF dossier: bio sheet, cover letter, itinerary, audit table, defence clauses.',
    steps: [
      'Assemble sections in embassy order',
      'Render a real PDF (Helvetica, A4, paginated, page numbers)',
      'Save the markdown twin as a versioned artifact',
      'Stamp the tracking token on every page footer',
    ],
    output: 'PDF + artifact',
    agent: 'Dossier Writer',
  },
  {
    id: 'cover-letter',
    name: 'Cover Letter / SOP Writer',
    icon: 'pen',
    category: 'Documents',
    summary: 'Writes the mission-addressed letter: purpose, profile, funding, ties to the home country.',
    steps: [
      'Address the diplomatic mission for the selected system',
      'State purpose and dates in the first line',
      'Add employment and funding evidence',
      'Close with contact details and a truthfulness declaration',
    ],
    output: 'Letter section in the dossier',
    agent: 'Dossier Writer',
  },
  {
    id: 'itinerary',
    name: 'Itinerary Builder',
    icon: 'cal',
    category: 'Documents',
    summary: 'Turns arrival and departure dates into a day-by-day plan that matches the hotel and flight dates.',
    steps: ['Expand the date range day by day', 'Assign arrival, working and departure days', 'Keep every night accounted for by the booked hotel'],
    output: 'Dated travel plan',
    agent: 'Dossier Writer',
  },
  {
    id: 'refusal-defence',
    name: 'Refusal Defence',
    icon: 'shield',
    category: 'Guardrails',
    summary: 'Answers the refusal grounds of the destination before the officer raises them.',
    steps: [
      'Attach the jurisdiction clause (e.g. AU PIC 600.211, TR Law 6458 Art. 15)',
      'Match each clause to evidence in the file',
      'Disclose prior refusals in the letter rather than leaving a gap',
    ],
    output: 'Numbered defence section',
    agent: 'Refusal Defence Analyst',
  },
  {
    id: 'field-mapper',
    name: 'Portal Field Mapper',
    icon: 'link',
    category: 'Portal',
    summary: 'Translates the verified applicant block into the exact field keys of the destination portal form.',
    steps: ['Load the portal field schema', 'Bind each portal key to an applicant source', 'Fill select defaults only where the portal forces a value'],
    output: 'Portal payload',
    agent: 'Portal Navigator',
  },
  {
    id: 'portal-run',
    name: 'Live Portal Run',
    icon: 'browser',
    category: 'Portal',
    summary: 'Runs the portal form field by field with a live status feed, and halts hard before submit or payment.',
    steps: [
      'Open the official portal for the jurisdiction',
      'Type identity fields, then contact, trip and attachments',
      'Stream status badges while the run is in progress',
      'HALT at the final review page and wait for a human',
      'Only a staff approval stamps the reference number',
    ],
    output: 'Run log + HITL gate',
    agent: 'Portal Navigator',
  },
  {
    id: 'doc-audit',
    name: 'Document Auditor',
    icon: 'check',
    category: 'Guardrails',
    summary: 'Re-checks every attachment and field one final time and blocks the hand-off on any BLOCK verdict.',
    steps: ['Recompute all rule verdicts from scratch', 'Block the portal run on a BLOCK result', 'Record the audit table inside the dossier'],
    output: 'Audit table',
    agent: 'Visa Case Officer',
  },
  {
    id: 'token-issuer',
    name: 'Tracking Token Issuer',
    icon: 'tag',
    category: 'Portal',
    summary: 'Issues the VM-YY-COUNTRY-XXXXXX tracking token that links the dossier, the portal run and the client record.',
    steps: ['Derive the year and jurisdiction code', 'Generate a 6-character unambiguous body', 'Stamp it on the dossier and the run log'],
    output: 'Tracking token',
    agent: 'Visa Case Officer',
  },
];

export const skillsFor = (agent: string) => SKILLS.filter((s) => s.agent === agent);
