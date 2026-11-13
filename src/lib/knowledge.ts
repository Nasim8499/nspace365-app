// 8-country visa knowledge matrix.
// Portal endpoints, validity rules, form names, field mapping and refusal-defence
// clauses used by the Visa Automate pipeline. Fees and timings are indicative:
// always confirm on the official portal before filing.

export type FieldSource =
  | 'surname'
  | 'givenNames'
  | 'fullName'
  | 'passportNo'
  | 'nationality'
  | 'birthDate'
  | 'expiryDate'
  | 'sex'
  | 'placeOfBirth'
  | 'email'
  | 'phone'
  | 'address'
  | 'hotel'
  | 'arrival'
  | 'departure'
  | 'purpose'
  | 'occupation'
  | 'employer'
  | 'funds'
  | 'insurance'
  | 'sponsor'
  | 'photo';

export interface PortalField {
  portal: string;
  label: string;
  source: FieldSource;
  type: 'text' | 'date' | 'select' | 'file' | 'radio';
  options?: string[];
  required?: boolean;
}

export interface Jurisdiction {
  code: string;
  country: string;
  flag: string;
  system: string;
  portal: string;
  portalUrl: string;
  form: string;
  fee: string;
  processing: string;
  /** minimum days the passport must stay valid past the intended departure */
  validityDaysBeyondStay: number;
  /** human wording of the validity rule */
  validityRule: string;
  requires: string[];
  sponsor?: string;
  refusalClause: string;
  refusalDefence: string[];
  fields: PortalField[];
  notes: string;
}

const commonIdentity: PortalField[] = [
  { portal: 'surname', label: 'Family name', source: 'surname', type: 'text', required: true },
  { portal: 'given_names', label: 'Given names', source: 'givenNames', type: 'text', required: true },
  { portal: 'passport_number', label: 'Passport number', source: 'passportNo', type: 'text', required: true },
  { portal: 'nationality', label: 'Nationality', source: 'nationality', type: 'select', required: true },
  { portal: 'date_of_birth', label: 'Date of birth', source: 'birthDate', type: 'date', required: true },
  { portal: 'passport_expiry', label: 'Passport expiry', source: 'expiryDate', type: 'date', required: true },
  { portal: 'sex', label: 'Sex', source: 'sex', type: 'select', options: ['M', 'F', 'X'], required: true },
];

const contactBlock: PortalField[] = [
  { portal: 'email', label: 'Email address', source: 'email', type: 'text', required: true },
  { portal: 'phone', label: 'Mobile number', source: 'phone', type: 'text', required: true },
  { portal: 'home_address', label: 'Residential address', source: 'address', type: 'text', required: true },
];

const tripBlock: PortalField[] = [
  { portal: 'intended_arrival', label: 'Intended arrival', source: 'arrival', type: 'date', required: true },
  { portal: 'intended_departure', label: 'Intended departure', source: 'departure', type: 'date', required: true },
  { portal: 'accommodation', label: 'Address in destination', source: 'hotel', type: 'text', required: true },
  { portal: 'purpose_of_visit', label: 'Purpose of visit', source: 'purpose', type: 'select', required: true },
];

const workBlock: PortalField[] = [
  { portal: 'occupation', label: 'Occupation', source: 'occupation', type: 'text' },
  { portal: 'employer', label: 'Employer / business', source: 'employer', type: 'text' },
  { portal: 'funds_available', label: 'Funds available (USD)', source: 'funds', type: 'text' },
];

export const JURISDICTIONS: Jurisdiction[] = [
  {
    code: 'AU',
    country: 'Australia',
    flag: '🇦🇺',
    system: 'ImmiAccount',
    portal: 'Department of Home Affairs — ImmiAccount',
    portalUrl: 'https://online.immi.gov.au/lusc/login',
    form: 'Form 1419 · Visitor visa (subclass 600)',
    fee: 'AUD ~200 (indicative)',
    processing: '14–45 days',
    validityDaysBeyondStay: 0,
    validityRule:
      'Passport must be valid for the whole period of stay. No statutory 6-month rule, but keep 6 months as the safe margin agencies use.',
    requires: [
      'Passport bio page',
      'Genuine temporary entrant statement',
      'Bank statements (3 months)',
      'Employment / business evidence',
      'Travel itinerary and stay address',
    ],
    refusalClause: 'Migration Act s 65 · Public Interest Criteria 600.211 (genuine temporary entrant) and 4020 (fraud)',
    refusalDefence: [
      'States employment, income and property ties with dated evidence.',
      'Shows a funded, dated itinerary with return travel booked.',
      'Explains the visit purpose in one paragraph with no gap in the story.',
      'Declares any previous refusal before it is discovered by the case officer.',
    ],
    fields: [
      ...commonIdentity,
      ...contactBlock,
      ...tripBlock.filter((f) => f.portal !== 'accommodation'),
      { portal: 'stay_address', label: 'Address in Australia', source: 'hotel', type: 'text', required: true },
      ...workBlock,
      { portal: 'health_insurance', label: 'Overseas visitor health cover', source: 'insurance', type: 'file' },
      { portal: 'dossier_pdf', label: 'Attach supporting dossier', source: 'photo', type: 'file', required: true },
    ],
    notes:
      'ImmiAccount sessions idle out in ~20 minutes. File the dossier attachment first, personal particulars last, so a timeout does not lose typed data.',
  },
  {
    code: 'TR',
    country: 'Türkiye',
    flag: '🇹🇷',
    system: 'e-Visa',
    portal: 'Republic of Türkiye — Electronic Visa Application',
    portalUrl: 'https://www.evisa.gov.tr/en/apply/',
    form: 'e-Visa application (tourist / business)',
    fee: 'USD ~50 + service fee (indicative)',
    processing: 'Minutes to 3 days',
    validityDaysBeyondStay: 60,
    validityRule:
      'Passport must remain valid at least 60 days beyond the expiry of the permitted stay (practically: 6 months from arrival).',
    requires: [
      'Passport bio page',
      'Return ticket',
      'Hotel booking',
      'Proof of sufficient funds (USD ~50/day)',
    ],
    refusalClause: 'Law No. 6458 on Foreigners and International Protection, Art. 15 (grounds for refusal)',
    refusalDefence: [
      'Confirms passport validity clears the 60-day margin at the intended departure date.',
      'Shows a return ticket that matches the declared stay length.',
      'Declares the daily funds figure consistent with the hotel category.',
      'Keeps the travel dates inside the e-Visa validity window.',
    ],
    fields: [
      { portal: 'country_of_origin', label: 'Country of origin', source: 'nationality', type: 'select', required: true },
      { portal: 'document_type', label: 'Travel document type', source: 'passportNo', type: 'select', options: ['Ordinary passport', 'Official passport'] },
      ...commonIdentity,
      ...contactBlock,
      { portal: 'arrival_date', label: 'Date of arrival in Türkiye', source: 'arrival', type: 'date', required: true },
      { portal: 'return_date', label: 'Date of return', source: 'departure', type: 'date', required: true },
      { portal: 'hotel_name', label: 'Hotel / accommodation', source: 'hotel', type: 'text', required: true },
      ...workBlock,
    ],
    notes: 'The e-Visa portal times out in 30 minutes and requires the exact arrival date. Book the hotel before starting.',
  },
  {
    code: 'RS',
    country: 'Serbia',
    flag: '🇷🇸',
    system: 'Consular portal',
    portal: 'Ministry of Foreign Affairs — visa (C) application',
    portalUrl: 'https://www.mfa.gov.rs/en',
    form: 'Visa C application form',
    fee: 'EUR 90 (indicative)',
    processing: '10–30 days',
    validityDaysBeyondStay: 90,
    validityRule:
      'Passport must be valid at least 90 days beyond the intended date of leaving the Schengen/Serbia area, issued within the last 10 years.',
    requires: [
      'Passport bio page',
      'Travel medical insurance (EUR 30,000 cover)',
      'Return ticket and hotel booking',
      'Bank statements',
      'Employment confirmation',
    ],
    refusalClause: 'Serbian Foreigners Act (Zakon o strancima), Art. 20-23 (visa refusal grounds)',
    refusalDefence: [
      'Attaches insurance that covers the full stay with the required EUR 30,000 limit.',
      'Matches hotel dates to the flight dates to the day.',
      'Shows employment continuity and approved leave.',
      'Explains any earlier Balkan or Schengen refusal in the cover letter.',
    ],
    fields: [
      ...commonIdentity,
      ...contactBlock,
      ...tripBlock,
      ...workBlock,
      { portal: 'travel_insurance', label: 'Travel medical insurance', source: 'insurance', type: 'file', required: true },
      { portal: 'dossier_pdf', label: 'Supporting documents', source: 'photo', type: 'file', required: true },
    ],
    notes: 'The consular portal asks for insurance policy details before the applicant fields. Have the policy number ready.',
  },
  {
    code: 'RU',
    country: 'Russia',
    flag: '🇷🇺',
    system: 'Unified e-Visa',
    portal: 'Ministry of Foreign Affairs — Unified e-Visa',
    portalUrl: 'https://evisa.kdmid.ru/',
    form: 'Unified electronic visa application',
    fee: 'USD ~60 (indicative)',
    processing: '4–7 days',
    validityDaysBeyondStay: 0,
    validityRule:
      'Passport must be valid at least 6 months from the e-Visa start date; e-Visa allows 16 days inside a 60-day window.',
    requires: [
      'Passport bio page',
      'Recent digital photo (35×45 mm)',
      'Hotel booking',
      'Travel insurance',
    ],
    refusalClause: 'Federal Law No. 114-FZ, Art. 26-27 (grounds for entry denial / visa refusal)',
    refusalDefence: [
      'Keeps the stay inside the 16-day e-Visa ceiling with flight dates that prove it.',
      'Uploads a photo that meets the 35×45 mm specification first time.',
      'Declares the host or hotel address exactly as registered.',
      'Names the entry point on the application, not on arrival.',
    ],
    fields: [
      ...commonIdentity,
      ...contactBlock,
      { portal: 'entry_point', label: 'Border crossing point', source: 'arrival', type: 'select' },
      { portal: 'stay_dates', label: 'Dates of stay', source: 'departure', type: 'date', required: true },
      { portal: 'host_details', label: 'Hotel / host details', source: 'hotel', type: 'text', required: true },
      ...workBlock,
      { portal: 'photo', label: 'Digital photograph', source: 'photo', type: 'file', required: true },
    ],
    notes: 'e-Visa applications close 4 days before travel. Photo rejections are the most common failure on this portal.',
  },
  {
    code: 'SG',
    country: 'Singapore',
    flag: '🇸🇬',
    system: 'SAVE / Form 14A',
    portal: 'ICA — Submission of Application for Visa Electronically (SAVE)',
    portalUrl: 'https://eservices.ica.gov.sg/esvclandingpage/save',
    form: 'Form 14A + Form V39A (local sponsor)',
    fee: 'SGD 30 (indicative)',
    processing: '3–7 working days',
    validityDaysBeyondStay: 180,
    validityRule:
      'Passport must be valid at least 6 months from the date of arrival in Singapore.',
    requires: [
      'Passport bio page',
      'Form 14A',
      'Form V39A completed by a Singapore citizen/PR sponsor',
      'Digital photo (400×514 px, white background)',
      'Return ticket',
    ],
    sponsor: 'A Singapore citizen or PR must submit Form V39A with Singpass — applications filed from overseas without a sponsor are rejected.',
    refusalClause: 'Immigration Act 1959, s 8 (visa conditions) read with ICA visa conditions',
    refusalDefence: [
      'Sponsor submits Form V39A before the applicant part is filed.',
      'Photo meets ICA pixel dimensions and white background spec.',
      'Return ticket date is inside the granted stay.',
      'Applicant states the visit purpose consistent with the sponsor relationship.',
    ],
    fields: [
      ...commonIdentity,
      ...contactBlock,
      ...tripBlock,
      ...workBlock,
      { portal: 'sponsor_nric', label: 'Sponsor NRIC / FIN', source: 'sponsor', type: 'text', required: true },
      { portal: 'form_v39a', label: 'Form V39A (sponsor declaration)', source: 'insurance', type: 'file', required: true },
      { portal: 'photo', label: 'Photograph', source: 'photo', type: 'file', required: true },
    ],
    notes: 'SAVE needs the sponsor ID first; the applicant fields are gated behind it. This is where most agencies stall.',
  },
  {
    code: 'MY',
    country: 'Malaysia',
    flag: '🇲🇾',
    system: 'MYVISA',
    portal: 'Immigration Department — eVISA portal',
    portalUrl: 'https://malaysiavisa.imi.gov.my/evisa/evisa.jsp',
    form: 'eVISA application (tourist)',
    fee: 'MYR ~105 (indicative)',
    processing: '2–7 working days',
    validityDaysBeyondStay: 180,
    validityRule: 'Passport must be valid at least 6 months from the date of entry into Malaysia.',
    requires: [
      'Passport bio page',
      'Digital photo (white background)',
      'Return flight booking',
      'Hotel confirmation',
      'Bank statement',
    ],
    refusalClause: 'Immigration Act 1959/63, s 8 (prohibited persons / entry conditions)',
    refusalDefence: [
      'Photo meets the white-background spec; a grey background is an automatic return.',
      'Return ticket is inside the 30-day visa-free or granted stay window.',
      'Bank balance is consistent with the declared hotel and trip length.',
      'Previous Malaysian overstay is disclosed with the explanation letter.',
    ],
    fields: [
      ...commonIdentity,
      ...contactBlock,
      ...tripBlock,
      ...workBlock,
      { portal: 'return_ticket', label: 'Return ticket (PDF)', source: 'insurance', type: 'file' },
      { portal: 'photo', label: 'Digital photograph', source: 'photo', type: 'file', required: true },
    ],
    notes: 'MYVISA sessions expire in 15 minutes. Upload the photo first; the form drops unsaved pages on timeout.',
  },
  {
    code: 'SA',
    country: 'Saudi Arabia',
    flag: '🇸🇦',
    system: 'KSA Visa',
    portal: 'Ministry of Foreign Affairs — Saudi Visa Portal',
    portalUrl: 'https://visa.mofa.gov.sa/',
    form: 'Tourist / visit eVisa',
    fee: 'SAR ~300 + insurance (indicative)',
    processing: '1–5 working days',
    validityDaysBeyondStay: 180,
    validityRule: 'Passport must be valid at least 6 months from the date of entry.',
    requires: [
      'Passport bio page',
      'Digital photo with white background',
      'Mandatory medical insurance (via the portal)',
      'Confirmed hotel booking',
      'Return flight',
    ],
    refusalClause: 'Saudi visa regulations (MOFA) — entry eligibility and security screening',
    refusalDefence: [
      'Buys the mandatory insurance inside the portal, not from a third party.',
      'Hotel booking matches the declared arrival and departure.',
      'Names the exact purpose (Umrah, tourism, business) rather than "visit".',
      'Confirms passport has two blank pages for the visa sticker.',
    ],
    fields: [
      ...commonIdentity,
      ...contactBlock,
      ...tripBlock,
      ...workBlock,
      { portal: 'insurance_policy', label: 'Medical insurance (portal issued)', source: 'insurance', type: 'file' },
      { portal: 'photo', label: 'Photograph', source: 'photo', type: 'file', required: true },
    ],
    notes: 'Insurance is purchased inside the portal flow, so the run must not be paused between insurance and payment.',
  },
  {
    code: 'BH',
    country: 'Bahrain',
    flag: '🇧🇭',
    system: 'Bahrain eVisa',
    portal: 'NPRA — Bahrain Electronic Visa',
    portalUrl: 'https://www.evisa.gov.bh/',
    form: 'Visit eVisa (2 weeks / 1 month)',
    fee: 'BHD ~9 (indicative)',
    processing: '1–3 working days',
    validityDaysBeyondStay: 180,
    validityRule: 'Passport must be valid at least 6 months from the date of entry.',
    requires: [
      'Passport bio page',
      'Digital photo',
      'Hotel booking or host details',
      'Return ticket',
      'Bank statement',
    ],
    refusalClause: 'NPRA visa conditions — visit visa eligibility',
    refusalDefence: [
      'Passport validity clears 6 months from the arrival date.',
      'Hotel or host address matches the declared arrival.',
      'Return ticket is inside the 14-day visit window.',
      'Funds evidence matches a Bahrain hotel rate, not a low-cost claim.',
    ],
    fields: [
      ...commonIdentity,
      ...contactBlock,
      ...tripBlock,
      ...workBlock,
      { portal: 'return_ticket', label: 'Return ticket', source: 'insurance', type: 'file' },
      { portal: 'photo', label: 'Photograph', source: 'photo', type: 'file', required: true },
    ],
    notes: 'evisa.gov.bh rejects duplicate applications for the same passport within 24 hours. One run per applicant.',
  },
];

export const byCode = (code: string) => JURISDICTIONS.find((j) => j.code === code) || JURISDICTIONS[0];

export const PURPOSES = [
  'Tourism',
  'Business meetings',
  'Family visit',
  'Conference',
  'Medical treatment',
  'Transit',
  'Umrah',
  'Study short course',
];

/** Nationality list kept short: the 8 jurisdictions plus the usual applicant origins. */
export const NATIONALITIES = [
  'Bangladesh',
  'India',
  'Pakistan',
  'Nepal',
  'Sri Lanka',
  'Philippines',
  'Indonesia',
  'Malaysia',
  'Vietnam',
  'Nigeria',
  'Kenya',
  'Egypt',
  'Türkiye',
  'United Kingdom',
  'United States',
  'Australia',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Russia',
  'Serbia',
  'Saudi Arabia',
  'Bahrain',
  'Singapore',
  'United Arab Emirates',
];

/** ISO 3166 alpha-3 codes that appear in MRZ lines. */
export const MRZ_COUNTRIES: Record<string, string> = {
  BGD: 'Bangladesh',
  IND: 'India',
  PAK: 'Pakistan',
  NPL: 'Nepal',
  LKA: 'Sri Lanka',
  PHL: 'Philippines',
  IDN: 'Indonesia',
  MYS: 'Malaysia',
  VNM: 'Vietnam',
  NGA: 'Nigeria',
  KEN: 'Kenya',
  EGY: 'Egypt',
  TUR: 'Türkiye',
  GBR: 'United Kingdom',
  USA: 'United States',
  AUS: 'Australia',
  DEU: 'Germany',
  FRA: 'France',
  ITA: 'Italy',
  ESP: 'Spain',
  RUS: 'Russia',
  SRB: 'Serbia',
  SAU: 'Saudi Arabia',
  BHR: 'Bahrain',
  SGP: 'Singapore',
  ARE: 'United Arab Emirates',
  DZA: 'Algeria',
  MAR: 'Morocco',
  ZAF: 'South Africa',
  CHN: 'China',
  THA: 'Thailand',
  KOR: 'South Korea',
  JPN: 'Japan',
  CAN: 'Canada',
  NLD: 'Netherlands',
  SWE: 'Sweden',
  NOR: 'Norway',
  CHE: 'Switzerland',
  QAT: 'Qatar',
  KWT: 'Kuwait',
  OMN: 'Oman',
  JOR: 'Jordan',
  LBN: 'Lebanon',
  IRQ: 'Iraq',
  IRN: 'Iran',
  AFG: 'Afghanistan',
  MMR: 'Myanmar',
  KHM: 'Cambodia',
  UZB: 'Uzbekistan',
  UKR: 'Ukraine',
  POL: 'Poland',
  ROU: 'Romania',
  BGR: 'Bulgaria',
  GRC: 'Greece',
};
