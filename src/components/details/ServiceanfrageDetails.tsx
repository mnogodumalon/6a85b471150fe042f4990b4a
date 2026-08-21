import type { Serviceanfrage, Auftragsverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MapRouteLinks } from '@/components/widgets/MapWidget';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface ServiceanfrageDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Serviceanfrage;
  /** 1:N „Auftragsverwaltung" (anfrage): VOLLE Liste — der Block filtert auf diesen Record. */
  auftragsverwaltungList: Auftragsverwaltung[];
  /** Zeilen-Klick → overlay.push auf das Auftragsverwaltung-Detail (nie der Edit-Dialog). */
  onOpenAuftragsverwaltung: (record: Auftragsverwaltung) => void;
  /** Kontextuelles „+": öffnet den Auftragsverwaltung-Dialog mit diesem Record vorgesetzt. */
  onAddAuftragsverwaltung: () => void;
}

export function ServiceanfrageDetails({
  record,
  auftragsverwaltungList,
  onOpenAuftragsverwaltung,
  onAddAuftragsverwaltung,
}: ServiceanfrageDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('serviceanfrage', 'problembeschreibung')} value={record.fields.problembeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('serviceanfrage', 'dringlichkeit')} value={record.fields.dringlichkeit} format="pill" />
        <RecordField label={fieldLabel('serviceanfrage', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('serviceanfrage', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('serviceanfrage', 'plz')} value={record.fields.plz} format="text" />
        <RecordField label={fieldLabel('serviceanfrage', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('serviceanfrage', 'einsatzort_geo')}>
          {record.fields.einsatzort_geo ? (
            <div className="space-y-1">
              <div>{record.fields.einsatzort_geo.info ?? `${record.fields.einsatzort_geo.lat}, ${record.fields.einsatzort_geo.long}`}</div>
              {/* Directions links — the map popup is hover-fleeting; the overlay
                  is the only mobile-reachable place for navigation. */}
              <MapRouteLinks lat={record.fields.einsatzort_geo.lat} long={record.fields.einsatzort_geo.long} />
            </div>
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('serviceanfrage', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('serviceanfrage', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('serviceanfrage', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('serviceanfrage', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('serviceanfrage', 'erreichbarkeit')} value={record.fields.erreichbarkeit} format="text" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('auftragsverwaltung')}
        items={auftragsverwaltungList.filter(r => extractRecordId(r.fields.anfrage) === record.record_id)}
        map={r => ({ name: appLabel('auftragsverwaltung'), meta: r.fields.erledigungsdatum })}
        onOpen={onOpenAuftragsverwaltung}
        onAdd={onAddAuftragsverwaltung}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.SERVICEANFRAGE} recordId={record.record_id} />
    </>
  );
}
