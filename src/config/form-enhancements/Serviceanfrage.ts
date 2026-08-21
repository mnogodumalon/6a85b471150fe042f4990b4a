import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'problembeschreibung',
    'dringlichkeit',
    'vorname',
    'nachname',
    'telefon',
    'email',
    'erreichbarkeit',
    { row: ['strasse', 'hausnummer'], cols: '2fr 1fr' },
    { row: ['plz', 'ort'], cols: '1fr 2fr' },
  ],
  defaults: {
    dringlichkeit: { kind: 'lookup', key: 'normal', label: 'Normal – innerhalb der nächsten Tage' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
