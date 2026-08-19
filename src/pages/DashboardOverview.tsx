import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { useState, useMemo } from 'react';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard, KanbanColumn } from '@/components/widgets/KanbanWidget';
import { MapWidget } from '@/components/widgets/MapWidget';
import type { MapMarker } from '@/components/widgets/MapWidget';
import { tx } from '@/i18n';
import { gruss, namen, useClock, undoToast } from '@/lib/polish';
import { format } from 'date-fns';
import { lookupKey } from '@/lib/formatters';
import { LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import {
  IconAlertTriangle,
  IconCheck,
  IconMapPin,
  IconList,
  IconBolt,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    serviceanfrage,
    auftragsverwaltung,
    setAuftragsverwaltung,
    serviceanfrageMap,
    loading, error, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) =>
      top.type === 'auftragsverwaltung' && !top.record.fields.erledigt
        ? {
            label: tx('Als erledigt markieren'),
            onClick: () => markDone(top.record),
          }
        : undefined,
  });

  const enrichedAuftragsverwaltung = crud.enriched.auftragsverwaltung;

  const clock = useClock();
  const [filterTone, setFilterTone] = useState<string | null>(null);

  // ─── ALL hooks ABOVE early returns ───
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Plain derivations below ───

  const today = format(clock, 'yyyy-MM-dd');

  // Auftragsverwaltung helper: find the linked Serviceanfrage
  const getAnfrage = (auftrag: typeof auftragsverwaltung[0]) => {
    const id = extractRecordId(auftrag.fields.anfrage);
    return id ? serviceanfrageMap.get(id) : undefined;
  };

  // Mark an Auftragsverwaltung record as done
  async function markDone(auftrag: typeof auftragsverwaltung[0]) {
    const snapshot = [...auftragsverwaltung];
    const updated = auftragsverwaltung.map(a =>
      a.record_id === auftrag.record_id
        ? { ...a, fields: { ...a.fields, erledigt: true, erledigungsdatum: today } }
        : a
    );
    setAuftragsverwaltung(updated);
    undoToast(
      tx`${auftrag.record_id} — ${tx('als erledigt markiert')}`,
      async () => {
        setAuftragsverwaltung(snapshot);
        await LivingAppsService.updateAuftragsverwaltungEntry(auftrag.record_id, {
          erledigt: false,
          erledigungsdatum: undefined,
        });
      }
    );
    try {
      await LivingAppsService.updateAuftragsverwaltungEntry(auftrag.record_id, {
        erledigt: true,
        erledigungsdatum: today,
      });
    } catch {
      setAuftragsverwaltung(snapshot);
      fetchAll();
    }
  }

  // KPI derivations
  const offeneAnfragen = serviceanfrage.filter(r => {
    // Consider open if no linked completed Auftrag
    const linked = auftragsverwaltung.find(a => extractRecordId(a.fields.anfrage) === r.record_id);
    return !linked?.fields.erledigt;
  });

  const notfallAnfragen = offeneAnfragen.filter(r => lookupKey(r.fields.dringlichkeit) === 'notfall');
  const dringendAnfragen = offeneAnfragen.filter(r => lookupKey(r.fields.dringlichkeit) === 'dringend');
  const dringlicheAnfragen = [...notfallAnfragen, ...dringendAnfragen];

  const heuteFertig = auftragsverwaltung.filter(
    a => a.fields.erledigt && a.fields.erledigungsdatum === today
  );

  const offeneAuftraege = enrichedAuftragsverwaltung.filter(a => !a.fields.erledigt);

  // Kanban columns from schema — INSIDE component body (locale-aware getter)
  const dringlichkeitOptionen = LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? [];
  const kanbanColumns: KanbanColumn[] = dringlichkeitOptionen.map(o => ({
    key: o.key,
    label: o.label,
    tone: o.key === 'notfall'
      ? 'destructive'
      : o.key === 'dringend'
      ? 'warning'
      : o.key === 'normal'
      ? 'primary'
      : 'default',
  }));

  // Kanban cards — map serviceanfragen onto dringlichkeit columns
  const kanbanCards: KanbanCard[] = serviceanfrage
    .filter(r => filterTone === null || lookupKey(r.fields.dringlichkeit) === filterTone)
    .map(r => {
      const linked = auftragsverwaltung.find(a => extractRecordId(a.fields.anfrage) === r.record_id);
      const done = linked?.fields.erledigt ?? false;
      const key = lookupKey(r.fields.dringlichkeit) ?? 'nicht_dringend';
      const col = kanbanColumns.find(c => c.key === key);
      return {
        id: `serviceanfrage:${r.record_id}`,
        column: key,
        tone: done ? 'success' : (col?.tone ?? 'default'),
        title: [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt'),
        subtitle: (
          <span className="text-xs text-muted-foreground">
            {[r.fields.strasse, r.fields.hausnummer, r.fields.ort].filter(Boolean).join(' ') || '—'}
            {done && <span className="ml-2 text-emerald-600 font-medium">{tx('Erledigt')}</span>}
          </span>
        ),
      };
    });

  // Handle card click → open detail overlay
  function handleCardClick(card: KanbanCard) {
    const id = card.id.split(':')[1];
    const record = serviceanfrage.find(r => r.record_id === id);
    if (record) crud.serviceanfrage.openDetail(record);
  }

  // Handle "+ Karte" for a column
  function handleAddCard(column: string) {
    crud.serviceanfrage.openCreate({ dringlichkeit: column });
  }

  // Map markers from requests with geo location
  const mapMarkers: MapMarker[] = serviceanfrage.flatMap(r => {
    const geo = r.fields.einsatzort_geo;
    if (!geo) return [];
    const linked = auftragsverwaltung.find(a => extractRecordId(a.fields.anfrage) === r.record_id);
    const done = linked?.fields.erledigt ?? false;
    const dring = lookupKey(r.fields.dringlichkeit);
    const tone: MapMarker['tone'] = done
      ? 'success'
      : dring === 'notfall'
      ? 'destructive'
      : dring === 'dringend'
      ? 'warning'
      : 'default';
    return [{
      id: `serviceanfrage:${r.record_id}`,
      lat: geo.lat,
      long: geo.long,
      title: [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ') || tx('Anfrage'),
      subtitle: geo.info ?? [r.fields.strasse, r.fields.ort].filter(Boolean).join(', '),
      tone,
    }];
  });

  // Human context line
  const dringendNames = namen(dringlicheAnfragen.map(r =>
    [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ')
  ));
  const contextLine = dringlicheAnfragen.length > 0
    ? dringlicheAnfragen.length === 1
      ? tx`${dringendNames} – dringende Anfrage wartet.`
      : tx`${dringendNames} – dringende Anfragen warten.`
    : offeneAnfragen.length > 0
    ? tx`${String(offeneAnfragen.length)} offene Anfragen – alles im Griff.`
    : tx('Keine offenen Anfragen – heute alles erledigt!');

  // Hero banner when there are notfall/dringend requests
  const heroBanner = dringlicheAnfragen.length > 0 ? (
    <HeroBanner
      icon={<IconAlertTriangle size={18} />}
      action={{
        label: tx('Anfrage öffnen'),
        onClick: () => {
          const first = dringlicheAnfragen[0];
          crud.serviceanfrage.openDetail(first);
        },
      }}
    >
      <b>{dringendNames}</b>{' '}
      {dringlicheAnfragen.length === 1
        ? tx('hat eine dringende Anfrage eingereicht.')
        : tx('haben dringende Anfragen eingereicht.')}
      {notfallAnfragen.length > 0 && (
        <span className="ml-2 text-destructive font-semibold">
          {notfallAnfragen.length === 1
            ? tx('Sofortiger Einsatz nötig!')
            : tx`${String(notfallAnfragen.length)} Notfälle – sofortiger Einsatz nötig!`}
        </span>
      )}
    </HeroBanner>
  ) : undefined;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {gruss(clock)} {/* i18n-exempt */}
          </h1>
          <p className="text-muted-foreground mt-1">{contextLine}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors shrink-0"
          onClick={() => crud.serviceanfrage.openCreate({})}
        >
          <IconBolt size={16} className="shrink-0" />
          {tx('Neue Anfrage')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroBanner}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen')}
              value={offeneAnfragen.length}
              icon={<IconList size={16} />}
              tone={offeneAnfragen.length === 0 ? 'success' : 'default'}
              onClick={() => setFilterTone(filterTone === 'all' ? null : 'all')}
              active={filterTone === 'all'}
            />
            <StatStripItem
              title={tx('Dringend')}
              value={dringlicheAnfragen.length}
              icon={<IconAlertTriangle size={16} />}
              tone={dringlicheAnfragen.length > 0 ? 'destructive' : 'default'}
              onClick={() => setFilterTone(f => f === 'dringend' ? null : 'dringend')}
              active={filterTone === 'dringend'}
            />
            <StatStripItem
              title={tx('Heute erledigt')}
              value={heuteFertig.length}
              icon={<IconCheck size={16} />}
              tone={heuteFertig.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Einsatzorte')}
              value={mapMarkers.length}
              icon={<IconMapPin size={16} />}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            columns={kanbanColumns}
            cards={kanbanCards}
            onCardClick={handleCardClick}
            onAddCard={handleAddCard}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Offene Aufträge')}
              items={offeneAuftraege.map(a => {
                const anfrage = getAnfrage(a);
                const name = a.anfrageName || tx('Unbekannt');
                const dring = anfrage ? lookupKey(anfrage.fields.dringlichkeit) : null;
                return {
                  id: a.record_id,
                  title: name,
                  secondLine: (
                    <span className="text-xs">
                      {dring === 'notfall' ? (
                        <span className="font-medium text-destructive">{tx('Notfall')}</span>
                      ) : dring === 'dringend' ? (
                        <span className="font-medium text-amber-600">{tx('Dringend')}</span>
                      ) : dring === 'normal' ? (
                        <span className="text-muted-foreground">{tx('Normal')}</span>
                      ) : (
                        <span className="text-muted-foreground">{tx('Nicht dringend')}</span>
                      )}
                      {anfrage?.fields.ort && (
                        <span className="text-muted-foreground"> · {anfrage.fields.ort}</span>
                      )}
                    </span>
                  ),
                  action: {
                    label: tx('✓ Erledigt'),
                    onClick: () => markDone(a),
                  },
                };
              })}
              onItemClick={id => {
                const auftrag = auftragsverwaltung.find(a => a.record_id === id);
                if (auftrag) crud.auftragsverwaltung.openDetail(auftrag);
              }}
              empty={{
                text: tx('Alle Aufträge erledigt — super gemacht!'),
                action: {
                  label: tx('Neuer Auftrag'),
                  onClick: () => crud.auftragsverwaltung.openCreate({}),
                },
              }}
            />
            {mapMarkers.length > 0 && (
              <MapWidget
                markers={mapMarkers}
                onMarkerClick={m => {
                  const id = m.id.split(':')[1];
                  const record = serviceanfrage.find(r => r.record_id === id);
                  if (record) crud.serviceanfrage.openDetail(record);
                }}
                onMapPointClick={(_point) => {
                  crud.serviceanfrage.openCreate({});
                }}
                legend={[
                  { label: tx('Notfall'), tone: 'destructive' },
                  { label: tx('Dringend'), tone: 'warning' },
                  { label: tx('Normal'), tone: 'default' },
                  { label: tx('Erledigt'), tone: 'success' },
                ]}
              />
            )}
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
