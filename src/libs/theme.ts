export interface Theme {
  id: string;
  name: string;
  desc: string;
  colors: string[];
}

export const THEMES: Theme[] = [
  {
    id: 'stitch',
    name: 'Stitch Cyber-Minimalist',
    desc: 'Default sleek dark cyan & lavender cyberpunk palette',
    colors: ['#070c0c', '#00f2fe', '#d0bcff'],
  },
  {
    id: 'cyberpunk',
    name: 'Neon Cyberpunk',
    desc: 'High-contrast hot pink & deep violet console screen',
    colors: ['#09000a', '#ff006e', '#3a86c8'],
  },
  {
    id: 'slate',
    name: 'Glassmorphism Slate',
    desc: 'Clean corporate slate blue, silver & steel design',
    colors: ['#0f172a', '#38bdf8', '#818cf8'],
  },
  {
    id: 'retro',
    name: 'Retro Terminal',
    desc: 'Phosphor monochrome matrix green with monospace details',
    colors: ['#000400', '#33ff33', '#11aa11'],
  },
  {
    id: 'crimson',
    name: 'Crimson Protocol',
    desc: 'Stealth tactical blood red & matte black terminal',
    colors: ['#0d0405', '#ef4444', '#9f1239'],
  },
];

export default THEMES;
