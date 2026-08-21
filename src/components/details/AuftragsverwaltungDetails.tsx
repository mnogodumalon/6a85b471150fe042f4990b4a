import type { Auftragsverwaltung, Serviceanfrage } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface AuftragsverwaltungDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Auftragsverwaltung;
  /** N:1-Ziel „Serviceanfrage": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  serviceanfrageList: Serviceanfrage[];
  /** Klick auf die Serviceanfrage-Relation → overlay.push auf dessen Detail. */
  onOpenServiceanfrage?: (record: Serviceanfrage) => void;
}

export function AuftragsverwaltungDetails({
  record,
  serviceanfrageList,
  onOpenServiceanfrage,
}: AuftragsverwaltungDetailsProps) {
  const anfrageTarget = serviceanfrageList.find(r => r.record_id === extractRecordId(record.fields.anfrage));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('auftragsverwaltung', 'erledigt')} value={record.fields.erledigt} format="bool" />
        <RecordField label={fieldLabel('auftragsverwaltung', 'erledigungsdatum')} value={record.fields.erledigungsdatum} format="date" />
        <RecordField label={fieldLabel('auftragsverwaltung', 'notizen')} value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('auftragsverwaltung', 'anfrage')}
          name={anfrageTarget?.fields.strasse ?? '—'}
          meta={[anfrageTarget?.fields.telefon, anfrageTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={anfrageTarget && onOpenServiceanfrage ? () => onOpenServiceanfrage!(anfrageTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.AUFTRAGSVERWALTUNG} recordId={record.record_id} />
    </>
  );
}
