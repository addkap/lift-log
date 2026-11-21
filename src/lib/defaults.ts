import type { Exercise, Template } from '../types';

// The preloaded workouts, in the exact order requested.
// updatedAt is 0 so that when sync arrives, any real edit always wins over these defaults,
// and two devices that each seed these defaults agree with each other.

const ex = (id: string, name: string): Exercise => ({ id, name, increment: 5, updatedAt: 0 });

export const DEFAULT_EXERCISES: Exercise[] = [
  ex('hack-squat', 'Hack squat'),
  ex('back-extension', 'Back extension (glute extension)'),
  ex('quad-extension', 'Quad extension'),
  ex('hamstring-curl', 'Hamstring curl'),
  ex('calf-raises', 'Calf raises'),
  ex('chest-press', 'Chest press'),
  ex('lat-pulldown', 'Lat pulldown'),
  ex('shoulder-press', 'Shoulder press'),
  ex('row-machine', 'Row machine'),
  ex('bicep-curls', 'Bicep curls'),
  ex('crunch-machine', 'Crunch machine'),
];

const item = (exerciseId: string, minSets: number, maxSets: number) => ({ exerciseId, minSets, maxSets });

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'lower',
    updatedAt: 0,
    items: [
      item('hack-squat', 3, 4),
      item('back-extension', 3, 4),
      item('quad-extension', 2, 3),
      item('hamstring-curl', 2, 3),
      item('calf-raises', 2, 3),
    ],
  },
  {
    id: 'upper',
    updatedAt: 0,
    items: [
      item('chest-press', 3, 4),
      item('lat-pulldown', 2, 3),
      item('shoulder-press', 2, 3),
      item('row-machine', 2, 3),
      item('bicep-curls', 2, 3),
      item('crunch-machine', 2, 3),
    ],
  },
  {
    id: 'full',
    updatedAt: 0,
    items: [
      item('hack-squat', 2, 3),
      item('chest-press', 2, 3),
      item('back-extension', 2, 3),
      item('row-machine', 2, 3),
      item('crunch-machine', 2, 3),
    ],
  },
];
