import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'anfrage',
    'erledigt',
    'erledigungsdatum',
    'notizen',
  ],
  defaults: {
    'erledigungsdatum': { kind: 'today' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
