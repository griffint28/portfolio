export type TagKey = 'backend' | 'frontend' | 'cloud' | 'data' | 'study';

export interface Tag {
  label: string;
  bg: string;
  fg: string;
}

export const TAGS: Record<TagKey, Tag> = {
  backend: { label: 'Backend', bg: 'var(--color-accent-100)', fg: 'var(--color-accent-800)' },
  frontend: { label: 'Frontend', bg: 'var(--color-accent-2-100)', fg: 'var(--color-accent-2-800)' },
  cloud: { label: 'Cloud & DevOps', bg: 'rgba(201,154,62,.16)', fg: '#7a5c1f' },
  data: { label: 'Data & Automation', bg: 'rgba(181,103,79,.16)', fg: '#7a3d2b' },
  study: { label: 'Coursework', bg: 'var(--color-neutral-200)', fg: 'var(--color-neutral-800)' },
};

export type LineId = 'main' | 'intern';
export type StopKind = 'terminus' | 'interchange' | 'minor';
export type StopDir = 'left' | 'right' | 'top' | 'bottom';

export interface Stop {
  id: string;
  line: LineId;
  kind: StopKind;
  at: [number, number];
  dir: StopDir;
  off?: [number, number];
  current?: boolean;
  name: string;
  place: string;
  role: string;
  dates: string;
  kicker: string;
  fly: { center: [number, number]; zoom: number; label: string };
  tags: TagKey[];
  highlights: string[];
}

export const STOPS: Stop[] = [
  {
    id: 'bear', line: 'intern', kind: 'terminus', at: [33.0185, -80.1756], dir: 'right',
    name: 'Bear Cognition', place: 'Summerville, SC', role: 'Software Engineer Intern', dates: 'Jan 2023 – May 2023',
    kicker: 'Internship line · Northern terminus', fly: { center: [33.0185, -80.1756], zoom: 14, label: 'Summerville' },
    tags: ['cloud', 'backend'], highlights: [
      'Led enterprise-wide cloud migration of 12 production services from GCP to AWS, cutting monthly infra costs 10%.',
      'Migrated 5 relational SQL databases and refactored cloud functions to serverless AWS Lambda, improving response times 25%.',
    ],
  },
  {
    id: 'hometown', line: 'main', kind: 'terminus', at: [33.0400, -80.4300], dir: 'right',
    name: 'Charlotte Metro', place: 'North Carolina', role: 'Where the line begins', dates: 'Origin station',
    kicker: 'Career line · Western terminus', fly: { center: [35.2271, -80.8431], zoom: 10, label: 'Charlotte Metro' },
    tags: [], highlights: ['Grew up in the Charlotte metro area before heading to the coast for college.'],
  },
  {
    id: 'college', line: 'main', kind: 'interchange', at: [32.7845, -79.9375], dir: 'left', off: [-26, 30],
    name: 'College of Charleston', place: 'Downtown Charleston, SC', role: 'B.S. Computer Science', dates: 'Aug 2019 – May 2023',
    kicker: 'Interchange · Career line & Internship line', fly: { center: [32.7845, -79.9375], zoom: 15, label: 'Downtown Charleston' },
    tags: ['study'], highlights: [
      'The interchange: both internships branch off these four years, and the career line carries on from here.',
    ],
  },
  {
    id: 'cs', line: 'main', kind: 'minor', at: [32.7915, -79.9263], dir: 'top',
    name: 'Computer Science Dept.', place: 'Harbor Walk East, Charleston, SC', role: 'Waypoint', dates: 'On the line',
    kicker: 'Career line · Waypoint', fly: { center: [32.7915, -79.9263], zoom: 16, label: 'Harbor Walk East' },
    tags: ['study'], highlights: [
      "Coursework and labs happened here, in the department's Harbor Walk East building on the Cooper River waterfront.",
    ],
  },
  {
    id: 'booz', line: 'main', kind: 'terminus', at: [32.9004, -79.9158], dir: 'top', current: true,
    name: 'Booz Allen Hamilton', place: 'Daniel Island, SC', role: 'Mid-Level Software Engineer', dates: 'June 2023 – Present',
    kicker: 'Career line · Eastern terminus', fly: { center: [32.9004, -79.9158], zoom: 15, label: 'Daniel Island' },
    tags: ['frontend', 'backend', 'cloud', 'data'], highlights: [
      'Engineered an AI-integrated web form (ChatGPT Gov) for claims processors — 24% faster queue time, 11% higher accuracy.',
      'Built an event-driven Kafka pipeline processing 2,000 veteran claims/day, cutting pre-processing errors 15%.',
      'Shipped Angular/TypeScript UIs serving 25,000 VA users; trained 50 developers on Ansible, cutting setup time from 20h to 6h.',
    ],
  },
  {
    id: 'adaptive', line: 'intern', kind: 'terminus', at: [32.6550, -79.7450], dir: 'top',
    name: 'Adaptive Biotechnologies', place: 'Remote — Seattle, WA', role: 'Software Engineer Intern', dates: 'May 2022 – Aug 2022',
    kicker: 'Internship line · Offshore terminus', fly: { center: [47.6205, -122.3493], zoom: 12, label: 'Seattle, WA' },
    tags: ['data'], highlights: [
      'Built Python automation scripts for company-wide KPI reporting pipelines.',
      'Eliminated 8 hours/week of manual data entry for executive stakeholders.',
    ],
  },
];

/* Career line — real road corridors, on land except at named bridges. Down the
   US-17A/SC-61 corridor from the northwest, then a western approach along the
   Savannah Hwy (US-17) and over the Ashley River bridge into downtown — kept
   clear of the intern line's I-26 descent; out of CofC up East Bay, over the
   Ravenel, north up Long Point Road, then I-526 over the Wando. */
export const CAREER: Array<[number, number, number?]> = [
  [33.1500, -80.4300],
  [33.0400, -80.4300, 1],
  [32.9231, -80.4300, 1],
  [32.7845, -80.2649],
  [32.7845, -79.9375, 1],
  [32.7915, -79.9263, 1],
  [32.8171, -79.8958],
  [32.8171, -79.8456, 1],
  [32.8761, -79.9158],
  [32.9004, -79.9158, 1],
];

/* Internship line — one unbroken 45° I-26 run from Summerville down the Neck to
   where the interstate ends at Meeting St, then Meeting St south through CofC,
   one clean turn east to the required waypoint, then the map's only true water
   leg: a single 45° run out through the harbour mouth. */
export const INTERN: Array<[number, number, number?]> = [
  [33.0185, -80.1756, 1],
  [32.8186, -79.9375],
  [32.7845, -79.9375, 1],
  [32.7711, -79.9286],
  [32.7694, -79.8984],
  [32.7567, -79.8747],
  [32.6550, -79.8018],
  [32.6550, -79.7450, 1],
];

export const HOME_BOUNDS: [[number, number], [number, number]] = [[32.628, -80.470], [33.058, -79.690]];

/* College of Charleston brand: maroon ring, gold halo, white core */
export const COFC = { maroon: '#660000', gold: '#bfa87c' };

/* asymmetric fit reserves the chrome: name card top-right, map key bottom-left,
   zoom control bottom-right, so terminus labels never grow under a panel */
export const FIT = { paddingTopLeft: [220, 150] as [number, number], paddingBottomRight: [320, 210] as [number, number] };

export const THEME = {
  career: '#b2622d',
  intern: '#56633f',
  weight: 9,
  /* Sand tone tile filter, baked in from the design tool's default preset (contrast before brightness) */
  filter: 'sepia(0.50) saturate(1.65) hue-rotate(-8deg) contrast(1.17) brightness(0.727)',
  water: '#a9bab7',
  label: '#e8d8b9',
};
