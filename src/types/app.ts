import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Serviceanfrage {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    problembeschreibung?: string;
    dringlichkeit?: LookupValue;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    einsatzort_geo?: GeoLocation; // { lat, long, info }
    vorname?: string;
    nachname?: string;
    telefon?: string;
    email?: string;
    erreichbarkeit?: string;
  };
}

export interface Auftragsverwaltung {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    anfrage?: string; // applookup -> URL zu 'Serviceanfrage' Record
    erledigt?: boolean;
    erledigungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    notizen?: string;
  };
}

export const APP_IDS = {
  SERVICEANFRAGE: '6a85b460cf17a31a72bcf59d',
  AUFTRAGSVERWALTUNG: '6a85b46412b8445c079128a7',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'serviceanfrage': {
    dringlichkeit: [{ key: "nicht_dringend", get label() { return lookupLabel('serviceanfrage', 'dringlichkeit', "nicht_dringend") ?? "Nicht dringend – kann warten"; } }, { key: "normal", get label() { return lookupLabel('serviceanfrage', 'dringlichkeit', "normal") ?? "Normal – innerhalb der nächsten Tage"; } }, { key: "dringend", get label() { return lookupLabel('serviceanfrage', 'dringlichkeit', "dringend") ?? "Dringend – so bald wie möglich"; } }, { key: "notfall", get label() { return lookupLabel('serviceanfrage', 'dringlichkeit', "notfall") ?? "Notfall – sofortiger Einsatz nötig"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'serviceanfrage': {
    'problembeschreibung': 'string/textarea',
    'dringlichkeit': 'lookup/radio',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'einsatzort_geo': 'geo',
    'vorname': 'string/text',
    'nachname': 'string/text',
    'telefon': 'string/tel',
    'email': 'string/email',
    'erreichbarkeit': 'string/text',
  },
  'auftragsverwaltung': {
    'anfrage': 'applookup/select',
    'erledigt': 'bool',
    'erledigungsdatum': 'date/date',
    'notizen': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateServiceanfrage = StripLookup<Serviceanfrage['fields']>;
export type CreateAuftragsverwaltung = StripLookup<Auftragsverwaltung['fields']>;