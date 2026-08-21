import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard, KanbanColumn } from '@/components/widgets/KanbanWidget';
import { MapWidget } from '@/components/widgets/MapWidget';
import type { MapMarker } from '@/components/widgets/MapWidget';
import { LOOKUP_OPTIONS, APP_IDS, lookupOption } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, appLabel } from '@/i18n';
import {
  IconAlertTriangle,
  IconBolt,
  IconCheck,
  IconClock,
  IconListCheck,
  IconMapPin,
  IconPlus,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    serviceanfrage,
    auftragsverwaltung,
    setAuftragsverwaltung,
    setServiceanfrage,
    serviceanfrageMap,
    loading,
    error,
    fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'serviceanfrage') {
        const linked = auftragsverwaltung.find(
          (a) => extractRecordId(a.fields.anfrage) === top.record.record_id
        );
        if (!linked) {
          return {
            label: tx('Auftrag anlegen'),
            onClick: () =>
              crud.auftragsverwaltung.openCreate({
                anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, top.record.record_id),
              }),
          };
        }
        if (!linked.fields.erledigt) {
          return {
            label: tx('Als erledigt markieren'),
            onClick: () => markDone(linked),
          };
        }
      }
      if (top.type === 'auftragsverwaltung' && !top.record.fields.erledigt) {
        return {
          label: tx('Als erledigt markieren'),
          onClick: () => markDone(top.record),
        };
      }
      return undefined;
    },
  });

  const enrichedAuftragsverwaltung = crud.enriched.auftragsverwaltung;

  // ─── All hooks above early returns ───────────────────────────────────────
  const [filterDringlichkeit, setFilterDringlichkeit] = useState<string | null>(null);

  // Map record_id -> linked Auftrag (must be above early returns)
  const auftragByAnfrage = useMemo(() => {
    const m = new Map<string, (typeof auftragsverwaltung)[0]>();
    for (const a of auftragsverwaltung) {
      const id = extractRecordId(a.fields.anfrage);
      if (id) m.set(id, a);
    }
    return m;
  }, [auftragsverwaltung]);

  const markDone = async (auftrag: (typeof auftragsverwaltung)[0]) => {
    const snapshot = [...auftragsverwaltung];
    setAuftragsverwaltung((prev) =>
      prev.map((a) =>
        a.record_id === auftrag.record_id
          ? { ...a, fields: { ...a.fields, erledigt: true } }
          : a
      )
    );
    undoToast(tx`${auftrag.record_id} — als erledigt markiert`, async () => {
      setAuftragsverwaltung(snapshot);
      await LivingAppsService.updateAuftragsverwaltungEntry(auftrag.record_id, {
        erledigt: false,
      }).catch(() => fetchAll());
    });
    await LivingAppsService.updateAuftragsverwaltungEntry(auftrag.record_id, {
      erledigt: true,
    }).catch(() => fetchAll());
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Derivations ─────────────────────────────────────────────────────────

  // Dringlichkeit options (locale-aware, inside body)
  const dringlichkeitOptions =
    LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? [];

  // KPI counts
  const notfaelle = serviceanfrage.filter(
    (r) => r.fields.dringlichkeit?.key === 'notfall'
  );
  const offene = serviceanfrage.filter((r) => {
    const linked = auftragByAnfrage.get(r.record_id);
    return !linked || !linked.fields.erledigt;
  });
  const erledigte = auftragsverwaltung.filter((a) => a.fields.erledigt);

  // Kanban columns from dringlichkeit lookup
  const kanbanColumns: KanbanColumn[] = dringlichkeitOptions.map((o) => ({
    key: o.key,
    label: o.label,
    tone:
      o.key === 'notfall'
        ? 'destructive'
        : o.key === 'dringend'
        ? 'warning'
        : o.key === 'normal'
        ? 'primary'
        : 'default',
  }));

  // KanbanCards from Serviceanfragen filtered by dringlichkeit if needed
  const displayedAnfragen = filterDringlichkeit
    ? serviceanfrage.filter(
        (r) => r.fields.dringlichkeit?.key === filterDringlichkeit
      )
    : serviceanfrage;

  const kanbanCards: KanbanCard[] = displayedAnfragen
    .filter((r) => {
      const linked = auftragByAnfrage.get(r.record_id);
      return !linked || !linked.fields.erledigt;
    })
    .map((r) => {
      const linked = auftragByAnfrage.get(r.record_id);
      return {
        id: `anfrage:${r.record_id}`,
        column: r.fields.dringlichkeit?.key ?? '',
        title: [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt'),
        subtitle: (
          <span className="text-xs text-muted-foreground truncate">
            {[r.fields.strasse, r.fields.hausnummer, r.fields.ort]
              .filter(Boolean)
              .join(' ')}
            {linked && !linked.fields.erledigt && (
              <span className="ml-2 text-amber-600">{tx('· In Bearbeitung')}</span>
            )}
          </span>
        ),
        tone:
          r.fields.dringlichkeit?.key === 'notfall'
            ? 'destructive'
            : r.fields.dringlichkeit?.key === 'dringend'
            ? 'warning'
            : 'default',
      } satisfies KanbanCard;
    });

  // WorkList: open requests without a completed job, sorted by urgency
  const urgencyOrder: Record<string, number> = {
    notfall: 0,
    dringend: 1,
    normal: 2,
    nicht_dringend: 3,
  };
  const offeneGesamt = offene.slice().sort((a, b) => {
    const au = urgencyOrder[a.fields.dringlichkeit?.key ?? ''] ?? 4;
    const bu = urgencyOrder[b.fields.dringlichkeit?.key ?? ''] ?? 4;
    return au - bu;
  });

  // MapMarkers: only requests WITH geo AND no completed job
  const mapMarkers: MapMarker[] = serviceanfrage.flatMap((r) => {
    const geo = r.fields.einsatzort_geo;
    if (!geo) return [];
    const linked = auftragByAnfrage.get(r.record_id);
    const done = linked?.fields.erledigt;
    return [
      {
        id: `anfrage:${r.record_id}`,
        lat: geo.lat,
        long: geo.long,
        title: [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ') || tx('Anfrage'),
        subtitle:
          [r.fields.strasse, r.fields.hausnummer, r.fields.ort]
            .filter(Boolean)
            .join(' ') || geo.info,
        tone: done
          ? 'success'
          : r.fields.dringlichkeit?.key === 'notfall'
          ? 'destructive'
          : r.fields.dringlichkeit?.key === 'dringend'
          ? 'warning'
          : 'default',
      } satisfies MapMarker,
    ];
  });

  // Context line
  const notfallNames = namen(notfaelle.map((r) =>
    [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ')
  ));
  const contextLine =
    notfaelle.length > 0
      ? tx`${notfallNames} — Notfall!`
      : offene.length === 0
      ? tx('Alle Anfragen erledigt. Super!')
      : tx`${offene.length} offene Anfragen.`;

  // Hero: Notfall-Anfragen
  const heroBanner =
    notfaelle.length > 0 ? (
      <HeroBanner
        icon={<IconAlertTriangle size={18} />}
        action={{
          label: tx('Auftrag anlegen'),
          onClick: () =>
            crud.auftragsverwaltung.openCreate({
              anfrage: createRecordUrl(
                APP_IDS.SERVICEANFRAGE,
                notfaelle[0].record_id
              ),
            }),
        }}
      >
        <b>{notfallNames}</b>{' '}
        {notfaelle.length === 1
          ? tx('hat einen Notfall gemeldet — sofortiger Einsatz nötig.')
          : tx('haben Notfälle gemeldet — sofortiger Einsatz nötig.')}
      </HeroBanner>
    ) : undefined;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {gruss(clock)}
          </h1>
          <p className="text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <Button
          onClick={() => crud.serviceanfrage.openCreate({})}
          className="shrink-0"
        >
          <IconPlus size={16} className="mr-1.5 shrink-0" />
          {tx('Neue Anfrage')}
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroBanner}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen')}
              value={offene.length}
              icon={<IconClock size={16} />}
              tone={offene.length > 0 ? 'warning' : 'default'}
              onClick={() =>
                setFilterDringlichkeit(
                  filterDringlichkeit === 'all_open' ? null : 'all_open'
                )
              }
              active={filterDringlichkeit === 'all_open'}
            />
            <StatStripItem
              title={tx('Notfälle')}
              value={notfaelle.length}
              icon={<IconBolt size={16} />}
              tone={notfaelle.length > 0 ? 'destructive' : 'default'}
              onClick={() =>
                setFilterDringlichkeit(
                  filterDringlichkeit === 'notfall' ? null : 'notfall'
                )
              }
              active={filterDringlichkeit === 'notfall'}
            />
            <StatStripItem
              title={tx('Erledigt')}
              value={erledigte.length}
              icon={<IconCheck size={16} />}
              tone={erledigte.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Gesamt')}
              value={serviceanfrage.length}
              icon={<IconListCheck size={16} />}
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            columns={kanbanColumns}
            cards={kanbanCards}
            onCardClick={(card) => {
              const id = card.id.split(':')[1];
              const rec = serviceanfrage.find((r) => r.record_id === id);
              if (rec) crud.serviceanfrage.openDetail(rec);
            }}
            onAddCard={(column) =>
              crud.serviceanfrage.openCreate({ dringlichkeit: column })
            }
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Offene Anfragen')}
              items={offeneGesamt.slice(0, 8).map((r) => {
                const linked = auftragByAnfrage.get(r.record_id);
                const name =
                  [r.fields.vorname, r.fields.nachname]
                    .filter(Boolean)
                    .join(' ') || tx('Unbekannt');
                const dringKey = r.fields.dringlichkeit?.key;
                return {
                  id: r.record_id,
                  title: name,
                  secondLine: (
                    <>
                      <span
                        className={
                          dringKey === 'notfall'
                            ? 'font-medium text-destructive'
                            : dringKey === 'dringend'
                            ? 'font-medium text-amber-600'
                            : 'text-muted-foreground'
                        }
                      >
                        {r.fields.dringlichkeit?.label ?? tx('Keine Dringlichkeit')}
                      </span>
                      {r.fields.ort && (
                        <span className="text-muted-foreground">
                          {' · '}
                          {r.fields.ort}
                        </span>
                      )}
                    </>
                  ),
                  action: !linked
                    ? {
                        label: tx('Auftrag anlegen'),
                        onClick: () =>
                          crud.auftragsverwaltung.openCreate({
                            anfrage: createRecordUrl(
                              APP_IDS.SERVICEANFRAGE,
                              r.record_id
                            ),
                          }),
                      }
                    : !linked.fields.erledigt
                    ? {
                        label: tx('✓ Erledigt'),
                        onClick: () => markDone(linked),
                      }
                    : undefined,
                };
              })}
              onItemClick={(id) => {
                const rec = serviceanfrage.find((r) => r.record_id === id);
                if (rec) crud.serviceanfrage.openDetail(rec);
              }}
              empty={{
                text: tx('Keine offenen Anfragen — alles erledigt!'),
                action: {
                  label: tx('Neue Anfrage erfassen'),
                  onClick: () => crud.serviceanfrage.openCreate({}),
                },
              }}
            />
            <MapWidget
              markers={mapMarkers}
              onMarkerClick={(marker) => {
                const id = marker.id.split(':')[1];
                const rec = serviceanfrage.find((r) => r.record_id === id);
                if (rec) crud.serviceanfrage.openDetail(rec);
              }}
              onMapPointClick={(_point) =>
                crud.serviceanfrage.openCreate({})
              }
              legend={[
                { label: tx('Notfall'), tone: 'destructive' },
                { label: tx('Dringend'), tone: 'warning' },
                { label: tx('Offen'), tone: 'default' },
                { label: tx('Erledigt'), tone: 'success' },
              ]}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
