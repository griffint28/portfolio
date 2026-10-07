export type TagKey = 'backend' | 'frontend' | 'cloud' | 'data' | 'study';

export interface Tag {
  label: string;
  bg: string;
  fg: string;
}

export const TAGS: Record<TagKey, Tag> = {
  backend: { label: 'Backend', bg: 'var(--color-accent-100)', fg: 'var(--color-accent-800)' },
  frontend: { label: 'Frontend', bg: 'var(--color-accent-2-100)', fg: 'var(--color-accent-2-800)' },
  cloud: { label: 'Cloud & DevOps', bg: 'rgba(201,154,62,.16)', fg: '#6b4f18' },
  data: { label: 'Data & Automation', bg: 'rgba(181,103,79,.16)', fg: '#6d3424' },
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
  /* Journey order. Drives the mobile station strip, which replaces the
     permanent map labels on phones. */
  seq: number;
  name: string;
  /* Compact name for the mobile strip, where full names don't fit. */
  short: string;
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
    id: 'bear', line: 'intern', kind: 'terminus', at: [33.0185, -80.1756], dir: 'right', seq: 4,
    name: 'Bear Cognition', short: 'Bear Cognition', place: 'Summerville, SC', role: 'Software Engineer Intern', dates: 'Jan 2023 – May 2023',
    kicker: 'Internship line · Northern terminus', fly: { center: [33.0185, -80.1756], zoom: 14, label: 'Summerville' },
    tags: ['cloud', 'backend'], highlights: [
      'Led enterprise-wide cloud migration of 12 production services from GCP to AWS, cutting monthly infra costs 10%.',
      'Migrated 5 relational SQL databases and refactored cloud functions to serverless AWS Lambda, improving response times 25%.',
    ],
  },
  {
    id: 'hometown', line: 'main', kind: 'terminus', at: [33.1082, -80.2950], dir: 'right', seq: 1,
    name: 'Charlotte Metro', short: 'Charlotte', place: 'North Carolina', role: 'Where the line begins', dates: 'Origin station',
    kicker: 'Career line · Northern terminus', fly: { center: [35.2271, -80.8431], zoom: 10, label: 'Charlotte Metro' },
    tags: [], highlights: ['Grew up in the Charlotte metro area before heading to the coast for college.'],
  },
  {
    id: 'college', line: 'main', kind: 'interchange', at: [32.7845, -79.9375], dir: 'left', off: [-26, 30], seq: 2,
    name: 'College of Charleston', short: 'CofC', place: 'Downtown Charleston, SC', role: 'B.S. Computer Science', dates: 'Aug 2019 – May 2023',
    kicker: 'Interchange · Career line & Internship line', fly: { center: [32.7845, -79.9375], zoom: 15, label: 'Downtown Charleston' },
    tags: ['study'], highlights: [
      'The interchange: both internships branch off these four years, and the career line carries on from here.',
      'Coursework and labs ran out of the Computer Science department on Harbor Walk East, on the Cooper River waterfront.',
    ],
  },
  {
    id: 'booz', line: 'main', kind: 'terminus', at: [32.9015, -79.9137], dir: 'top', current: true, seq: 5,
    name: 'Booz Allen Hamilton', short: 'Booz Allen', place: 'Daniel Island, SC', role: 'Mid-Level Software Engineer', dates: 'June 2023 – Present',
    kicker: 'Career line · Eastern terminus', fly: { center: [32.9004, -79.9158], zoom: 15, label: 'Daniel Island' },
    tags: ['frontend', 'backend', 'cloud', 'data'], highlights: [
      'Engineered an AI-integrated web form (ChatGPT Gov) for claims processors — 24% faster queue time, 11% higher accuracy.',
      'Built an event-driven Kafka pipeline processing 2,000 veteran claims/day, cutting pre-processing errors 15%.',
      'Shipped Angular/TypeScript UIs serving 25,000 VA users; trained 50 developers on Ansible, cutting setup time from 20h to 6h.',
    ],
  },
  {
    id: 'adaptive', line: 'intern', kind: 'terminus', at: [33.0185, -80.4295], dir: 'bottom', seq: 3,
    name: 'Adaptive Biotechnologies', short: 'Adaptive Bio', place: 'Remote — Seattle, WA', role: 'Software Engineer Intern', dates: 'May 2022 – Aug 2022',
    kicker: 'Internship line · Northwest, off the map to Seattle', fly: { center: [47.6205, -122.3493], zoom: 12, label: 'Seattle, WA' },
    tags: ['data'], highlights: [
      'Built Python automation scripts for company-wide KPI reporting pipelines.',
      'Eliminated 8 hours/week of manual data entry for executive stakeholders.',
    ],
  },
];


/* Career line — control points hand-placed in the Route Editor (?edit=1), then
   snapped to the 0/45/90 grid: dragging by hand lands a leg a degree or two off,
   and route() rounds corners but never squares up a leg, so the tool's raw export
   gets straightened before it lands here. The first point is an off-map runoff,
   so the line keeps going north past Charlotte instead of stopping dead at the
   frame.

   The tail out of CofC is the exception to all of that and is hand-placed:
   east to [32.8135, -79.8586], then back up north-west into Booz Allen. Both
   of those legs are off the grid -- about 24 and 62 degrees -- and they are
   meant to be, so do not let the Route Editor's snap straighten them. What
   carries the shape instead is the bend between them, which comes out near a
   right angle (94 degrees).

   If you ever want that corner exactly square, the rule is Thales: the points
   that see CofC and Booz Allen at 90 degrees are the circle whose diameter is
   the line between them, measured in route.ts's screen-square space rather
   than in raw degrees. On that circle the nearest point to this one is
   [32.8155, -79.8630]. */
export const CAREER: Array<[number, number, number?]> = [
  [43.0000, -80.2950],
  [33.0196, -80.2950, 1],
  [32.8606, -80.2950, 1],
  [32.7845, -80.2044, 1],
  [32.7845, -80.0745, 1],
  [32.7845, -79.9375, 1],
  [32.8135, -79.8586, 1],
  [32.9015, -79.9137, 1],
];

/* Internship line — same provenance and the same grid snap as CAREER above.
   Authored north-west to south-east: an off-map runoff toward Seattle, in past
   Adaptive, east along a level leg to Summerville, down the I-26 corridor, and
   into the College of Charleston interchange. Its one crossing with the career
   line is unavoidable — Adaptive sits west of the career corridor and Bear sits
   east of it, so the leg between them has to cut across. */
export const INTERN: Array<[number, number, number?]> = [
  [34.5000, -82.1930],
  [33.0185, -80.4295, 1],
  [33.0185, -80.1756, 1],
  [32.8329, -79.9545, 1],
  [32.8185, -79.9375, 1],
  [32.7845, -79.9375],
];

export const HOME_BOUNDS: [[number, number], [number, number]] = [[32.770, -80.450], [33.125, -79.840]];

/* asymmetric fit reserves the chrome: name card top-right, map key bottom-left,
   zoom control bottom-right, so terminus labels never grow under a panel */
export const FIT = { paddingTopLeft: [190, 120] as [number, number], paddingBottomRight: [280, 180] as [number, number] };

/* Mobile: no permanent labels and no zoom control (see TransitMap's isMobile
   branch and the phone media query), so the only chrome to reserve for is the
   slim name card up top and the station strip + button row along the bottom. */
export const FIT_MOBILE = { paddingTopLeft: [14, 84] as [number, number], paddingBottomRight: [14, 150] as [number, number] };

/* The palette that used to live here moved to lib/theme.ts, which is now the
   only place it is written down -- it pushes itself into the custom properties
   index.css reads, so the two can no longer drift. Tune it at ?theme=1. */
