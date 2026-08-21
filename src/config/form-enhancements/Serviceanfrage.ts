import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'problembeschreibung',
    'dringlichkeit',
    { row: ['strasse', 'hausnummer'] },
    { row: ['plz', 'ort'], cols: '1fr 2fr' },
    { row: ['vorname', 'nachname'] },
    'telefon',
    'email',
    'erreichbarkeit',
  ],
  defaults: {
    'dringlichkeit': { kind: 'lookup', key: 'normal', label: 'Normal – innerhalb der nächsten Tage' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};

export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
