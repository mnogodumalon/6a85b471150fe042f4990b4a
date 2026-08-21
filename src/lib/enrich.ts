import type { EnrichedAuftragsverwaltung } from '@/types/enriched';
import type { Auftragsverwaltung, Serviceanfrage } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface AuftragsverwaltungMaps {
  serviceanfrageMap: Map<string, Serviceanfrage>;
}

export function enrichAuftragsverwaltung(
  auftragsverwaltung: Auftragsverwaltung[],
  maps: AuftragsverwaltungMaps
): EnrichedAuftragsverwaltung[] {
  return auftragsverwaltung.map(r => ({
    ...r,
    anfrageName: resolveDisplay(r.fields.anfrage, maps.serviceanfrageMap, 'vorname', 'nachname'),
  }));
}
