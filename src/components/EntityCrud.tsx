/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'serviceanfrage'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` carries the snake_case IDENTIFIER, NOT the camelCase key that
 *   `crud.<entity>` uses — for multi-word entities the two differ. Take each
 *   from its own column below, verbatim; a camelCase top.type narrows `top`
 *   to `never` and costs a build cycle (TS2367 "have no overlap", then
 *   TS2339 on top.record):
 *     crud.serviceanfrage  ·  top.type === 'serviceanfrage'
 *     crud.auftragsverwaltung  ·  top.type === 'auftragsverwaltung'
 *   …
 *   crud.serviceanfrage.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.serviceanfrage.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.serviceanfrage.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.auftragsverwaltung              // memoized Enriched* arrays — reuse these,
 *                                       // never call enrich*() yourself in the page
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   serviceanfrage: problembeschreibung, dringlichkeit, strasse, hausnummer, plz, ort, einsatzort_geo, vorname, …  ·  ← auftragsverwaltung (list + contextual +)
 *   auftragsverwaltung: anfrage, erledigt, erledigungsdatum, notizen  ·  → serviceanfrage
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Serviceanfrage, Auftragsverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichAuftragsverwaltung } from '@/lib/enrich';
import type { EnrichedAuftragsverwaltung } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { ServiceanfrageDialog, type ServiceanfrageDialogDefaults } from '@/components/dialogs/ServiceanfrageDialog';
import { ServiceanfrageDetails } from '@/components/details/ServiceanfrageDetails';
import { AuftragsverwaltungDialog, type AuftragsverwaltungDialogDefaults } from '@/components/dialogs/AuftragsverwaltungDialog';
import { AuftragsverwaltungDetails } from '@/components/details/AuftragsverwaltungDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'serviceanfrage'; record: Serviceanfrage }
  | { type: 'auftragsverwaltung'; record: EnrichedAuftragsverwaltung };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  serviceanfrage: EntityCrudApi<Serviceanfrage, ServiceanfrageDialogDefaults>;
  auftragsverwaltung: EntityCrudApi<Auftragsverwaltung, AuftragsverwaltungDialogDefaults>;
  /** Memoized Enriched* arrays — reuse these, never re-enrich in the page. */
  enriched: { auftragsverwaltung: EnrichedAuftragsverwaltung[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [serviceanfrageDialog, setServiceanfrageDialog] = useState<{ defaults?: ServiceanfrageDialogDefaults; editing?: Serviceanfrage } | null>(null);
  const [auftragsverwaltungDialog, setAuftragsverwaltungDialog] = useState<{ defaults?: AuftragsverwaltungDialogDefaults; editing?: Auftragsverwaltung } | null>(null);
  const enrichedAuftragsverwaltung = useMemo(() => enrichAuftragsverwaltung(data.auftragsverwaltung, { serviceanfrageMap: data.serviceanfrageMap }), [data.auftragsverwaltung, data.serviceanfrageMap]);

  function detailServiceanfrage(record: Serviceanfrage, push = false) {
    const item: OverlayItem = { type: 'serviceanfrage', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitServiceanfrage(fields: Serviceanfrage['fields']) {
    const editing = serviceanfrageDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setServiceanfrage(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateServiceanfrageEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('serviceanfrage')} — ${t('crud_updated')}`, async () => {
        data.setServiceanfrage(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateServiceanfrageEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createServiceanfrageEntry(fields);
      undoToast(`${appLabel('serviceanfrage')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailAuftragsverwaltung(record: Auftragsverwaltung, push = false) {
    const rec = enrichedAuftragsverwaltung.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'auftragsverwaltung', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitAuftragsverwaltung(fields: Auftragsverwaltung['fields']) {
    const editing = auftragsverwaltungDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setAuftragsverwaltung(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateAuftragsverwaltungEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('auftragsverwaltung')} — ${t('crud_updated')}`, async () => {
        data.setAuftragsverwaltung(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateAuftragsverwaltungEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createAuftragsverwaltungEntry(fields);
      undoToast(`${appLabel('auftragsverwaltung')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <ServiceanfrageDialog
        open={serviceanfrageDialog !== null}
        onClose={() => setServiceanfrageDialog(null)}
        onSubmit={submitServiceanfrage}
        defaultValues={serviceanfrageDialog?.defaults}
        recordId={serviceanfrageDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Serviceanfrage']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Serviceanfrage']}
      />
      <AuftragsverwaltungDialog
        open={auftragsverwaltungDialog !== null}
        onClose={() => setAuftragsverwaltungDialog(null)}
        onSubmit={submitAuftragsverwaltung}
        defaultValues={auftragsverwaltungDialog?.defaults}
        recordId={auftragsverwaltungDialog?.editing?.record_id}
        serviceanfrageList={data.serviceanfrage}
        enablePhotoScan={AI_PHOTO_SCAN['Auftragsverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Auftragsverwaltung']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'serviceanfrage') {
            return (
              <>
                <RecordHeader title={top.record.fields.strasse ?? appLabel('serviceanfrage')} subtitle={undefined} />
                <ServiceanfrageDetails
                  record={top.record}
                  auftragsverwaltungList={data.auftragsverwaltung}
                  onOpenAuftragsverwaltung={(r) => detailAuftragsverwaltung(r, true)}
                  onAddAuftragsverwaltung={() => setAuftragsverwaltungDialog({ defaults: { anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'auftragsverwaltung') {
            return (
              <>
                <RecordHeader title={appLabel('auftragsverwaltung')} subtitle={top.record.fields.erledigungsdatum ? formatDate(top.record.fields.erledigungsdatum) : undefined} />
                <AuftragsverwaltungDetails
                  record={top.record}
                  serviceanfrageList={data.serviceanfrage}
                  onOpenServiceanfrage={(r) => detailServiceanfrage(r, true)}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'serviceanfrage') setServiceanfrageDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'auftragsverwaltung') setAuftragsverwaltungDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    serviceanfrage: {
      openCreate: (defaults?: ServiceanfrageDialogDefaults) => setServiceanfrageDialog({ defaults }),
      openEdit: (record: Serviceanfrage) => setServiceanfrageDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Serviceanfrage) => detailServiceanfrage(record, false),
    },
    auftragsverwaltung: {
      openCreate: (defaults?: AuftragsverwaltungDialogDefaults) => setAuftragsverwaltungDialog({ defaults }),
      openEdit: (record: Auftragsverwaltung) => setAuftragsverwaltungDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Auftragsverwaltung) => detailAuftragsverwaltung(record, false),
    },
    enriched: { auftragsverwaltung: enrichedAuftragsverwaltung },
  };
}
