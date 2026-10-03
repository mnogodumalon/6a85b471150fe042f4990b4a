// Auto-generated. Per-entity form-enhancements config for "Serviceanfrage".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{"row": ["vorname", "nachname"], "cols": "1fr 1fr"}, "telefon", "email", {"row": ["strasse", "hausnummer"], "cols": "2fr 1fr"}, {"row": ["plz", "ort"], "cols": "1fr 2fr"}, "dringlichkeit", "erreichbarkeit", "problembeschreibung"],
  defaults: {
    'dringlichkeit': { kind: 'lookup', key: 'normal', label: 'Normal – innerhalb der nächsten Tage' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
