import type { TagKey } from './stops';

export interface Project {
  id: string;
  name: string;
  description: string;
  tags: TagKey[];
  url?: string;
  repoUrl?: string;
}

/* Placeholder entries — tell me your real side projects (name, one-line description,
   tags, and a live/repo link if you have one) and I'll swap these in. */
export const PROJECTS: Project[] = [
  {
    id: 'placeholder-1',
    name: 'Project One',
    description: 'Placeholder — tell me what this one does and I’ll fill in the real description.',
    tags: ['frontend'],
    url: '#',
  },
  {
    id: 'placeholder-2',
    name: 'Project Two',
    description: 'Placeholder — tell me what this one does and I’ll fill in the real description.',
    tags: ['backend', 'data'],
    repoUrl: '#',
  },
];
