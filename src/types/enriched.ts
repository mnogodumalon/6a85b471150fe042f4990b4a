import type { Auftragsverwaltung } from './app';

export type EnrichedAuftragsverwaltung = Auftragsverwaltung & {
  anfrageName: string;
};
