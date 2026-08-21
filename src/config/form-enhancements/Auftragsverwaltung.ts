import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'anfrage',
    'erledigt',
    'erledigungsdatum',
    'notizen',
  ],
  defaults: {
    erledigt: { kind: 'literal', value: false },
    erledigungsdatum: { kind: 'todayOffset', days: 3 },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
