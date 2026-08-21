import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { MapWidget } from '@/components/widgets/MapWidget';
import type { MapMarker } from '@/components/widgets/MapWidget';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { useState, useMemo, useCallback } from 'react';
import { lookupKey, formatDate } from '@/lib/formatters';
import { extractRecordId, createRecordUrl, LivingAppsService } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import {
  IconAlertTriangle,
  IconMapPin,
  IconCheck,
  IconCircleCheck,
  IconBolt,
  IconClipboardList,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    serviceanfrage, auftragsverwaltung,
    serviceanfrageMap,
    loading, error, fetchAll,
    setAuftragsverwaltung,
  } = data;

  const clock = useClock();
  const [filterDringlichkeit, setFilterDringlichkeit] = useState<string | null>(null);

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'auftragsverwaltung') {
        const rec = top.record;
        if (!rec.fields.erledigt) {
          return {
            label: tx('Als erledigt markieren'),
            onClick: () => markErledigt(rec),
          };
        }
      }
      if (top.type === 'serviceanfrage') {
        const anfrage = top.record;
        const hatAuftrag = auftragsverwaltung.some(
          a => extractRecordId(a.fields.anfrage) === anfrage.record_id
        );
        if (!hatAuftrag) {
          return {
            label: tx('Auftrag anlegen'),
            onClick: () => crud.auftragsverwaltung.openCreate({
              anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, anfrage.record_id),
            }),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedAuftragsverwaltung = crud.enriched.auftragsverwaltung;

  const markErledigt = useCallback((rec: typeof auftragsverwaltung[number]) => {
    const prev = auftragsverwaltung;
    setAuftragsverwaltung(prev.map(a =>
      a.record_id === rec.record_id ? { ...a, fields: { ...a.fields, erledigt: true } } : a
    ));
    LivingAppsService.updateAuftragsverwaltungEntry(rec.record_id, { erledigt: true }).then(() => {
      undoToast(
        tx`${rec.record_id} — ${tx('als erledigt markiert')}`,
        () => {
          setAuftragsverwaltung(prev);
          LivingAppsService.updateAuftragsverwaltungEntry(rec.record_id, { erledigt: false });
        }
      );
    }).catch(() => fetchAll());
  }, [auftragsverwaltung, setAuftragsverwaltung, fetchAll]);

  const dringlichkeitOptions = useMemo(
    () => LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? [],
    []
  );

  // KPIs
  const notfaelle = useMemo(
    () => serviceanfrage.filter(r => lookupKey(r.fields.dringlichkeit) === 'notfall'),
    [serviceanfrage]
  );

  const offeneAnfragen = useMemo(
    () => serviceanfrage.filter(r => {
      const hatErledigtenAuftrag = auftragsverwaltung.some(
        a => extractRecordId(a.fields.anfrage) === r.record_id && a.fields.erledigt
      );
      return !hatErledigtenAuftrag;
    }),
    [serviceanfrage, auftragsverwaltung]
  );

  const erledigte = useMemo(
    () => auftragsverwaltung.filter(a => a.fields.erledigt).length,
    [auftragsverwaltung]
  );

  const gefiltert = useMemo(() => {
    if (!filterDringlichkeit) return offeneAnfragen;
    return offeneAnfragen.filter(r => lookupKey(r.fields.dringlichkeit) === filterDringlichkeit);
  }, [offeneAnfragen, filterDringlichkeit]);

  // Markers
  const markers = useMemo<MapMarker[]>(() => {
    return serviceanfrage.flatMap(r => {
      const geo = r.fields.einsatzort_geo;
      if (!geo) return [];
      const key = lookupKey(r.fields.dringlichkeit);
      const tone =
        key === 'notfall' ? 'destructive' :
        key === 'dringend' ? 'warning' :
        key === 'normal' ? 'primary' : 'default';
      const hatErledigtenAuftrag = auftragsverwaltung.some(
        a => extractRecordId(a.fields.anfrage) === r.record_id && a.fields.erledigt
      );
      return [{
        id: `serviceanfrage:${r.record_id}`,
        lat: geo.lat,
        long: geo.long,
        title: `${r.fields.vorname ?? ''} ${r.fields.nachname ?? ''}`.trim() || tx('Unbekannt'),
        subtitle: r.fields.dringlichkeit?.label,
        tone: hatErledigtenAuftrag ? 'success' : tone,
        icon: 'tool' as const,
      }];
    });
  }, [serviceanfrage, auftragsverwaltung]);

  // Aside: offene Anfragen nach Dringlichkeit sortiert
  const worklistItems = useMemo(() => {
    const sorted = [...gefiltert].sort((a, b) => {
      const order: Record<string, number> = { notfall: 0, dringend: 1, normal: 2, nicht_dringend: 3 };
      return (order[lookupKey(a.fields.dringlichkeit) ?? ''] ?? 9) -
             (order[lookupKey(b.fields.dringlichkeit) ?? ''] ?? 9);
    });
    return sorted.map(r => {
      const hatAuftrag = auftragsverwaltung.some(
        a => extractRecordId(a.fields.anfrage) === r.record_id
      );
      const key = lookupKey(r.fields.dringlichkeit);
      const farbe =
        key === 'notfall' ? 'text-destructive' :
        key === 'dringend' ? 'text-amber-600' :
        key === 'normal' ? 'text-primary' : 'text-muted-foreground';
      return {
        id: r.record_id,
        title: `${r.fields.vorname ?? ''} ${r.fields.nachname ?? ''}`.trim() || tx('Unbekannter Kunde'),
        secondLine: (
          <span>
            <span className={`font-medium ${farbe}`}>{r.fields.dringlichkeit?.label ?? '—'}</span>
            {r.fields.ort ? <span className="text-muted-foreground"> · {r.fields.ort}</span> : null}
          </span>
        ),
        action: !hatAuftrag ? {
          label: tx('Annehmen'),
          onClick: () => crud.auftragsverwaltung.openCreate({
            anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, r.record_id),
          }),
        } : undefined,
      };
    });
  }, [gefiltert, auftragsverwaltung, crud.auftragsverwaltung]);

  // Offene Aufträge (angenommen, aber noch nicht erledigt)
  const offeneAuftraege = useMemo(() => {
    return enrichedAuftragsverwaltung.filter(a => !a.fields.erledigt);
  }, [enrichedAuftragsverwaltung]);

  const auftraegeItems = useMemo(() => {
    return offeneAuftraege.map(a => {
      const anfrage = serviceanfrageMap.get(extractRecordId(a.fields.anfrage) ?? '');
      return {
        id: a.record_id,
        title: a.anfrageName || tx('Anfrage'),
        secondLine: (
          <span>
            <span className="font-medium text-amber-600">{tx('Offen')}</span>
            {anfrage?.fields.ort ? <span className="text-muted-foreground"> · {anfrage.fields.ort}</span> : null}
            {a.fields.erledigungsdatum ? <span className="text-muted-foreground"> · {formatDate(a.fields.erledigungsdatum)}</span> : null}
          </span>
        ),
        action: {
          label: tx('Erledigt'),
          onClick: () => markErledigt(a),
        },
      };
    });
  }, [offeneAuftraege, serviceanfrageMap, markErledigt]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Context line
  const notfallNamen = notfaelle.map(r => `${r.fields.vorname ?? ''} ${r.fields.nachname ?? ''}`.trim()).filter(Boolean);
  const contextLine = notfaelle.length > 0
    ? tx`Notfall: ${namen(notfallNamen)} braucht sofort Hilfe.`
    : offeneAnfragen.length === 0
    ? tx('Alles erledigt — keine offenen Anfragen.')
    : tx`${offeneAnfragen.length} offene Anfragen, ${erledigte} erledigt.`;

  const dringendCount = offeneAnfragen.filter(r => lookupKey(r.fields.dringlichkeit) === 'dringend').length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{gruss(clock)}</h1>
          <p className="text-muted-foreground mt-1">{contextLine}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          onClick={() => crud.serviceanfrage.openCreate({})}
        >
          <IconClipboardList size={16} className="shrink-0" />
          {tx('Neue Anfrage')}
        </button>
      </div>

      <DashboardGrid
        variant="split"
        hero={notfaelle.length > 0 ? (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: tx('Auftrag annehmen'),
              onClick: () => crud.auftragsverwaltung.openCreate({
                anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, notfaelle[0].record_id),
              }),
            }}
          >
            <b>{namen(notfallNamen)}</b>{' '}
            {notfaelle.length === 1 ? tx('meldet einen Notfall — sofortiger Einsatz nötig.') : tx('melden Notfälle — sofortiger Einsatz nötig.')}
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Notfälle')}
              value={notfaelle.length}
              icon={<IconBolt size={16} />}
              tone={notfaelle.length > 0 ? 'destructive' : 'default'}
              onClick={() => setFilterDringlichkeit(f => f === 'notfall' ? null : 'notfall')}
              active={filterDringlichkeit === 'notfall'}
            />
            <StatStripItem
              title={tx('Dringend')}
              value={dringendCount}
              icon={<IconAlertTriangle size={16} />}
              tone={dringendCount > 0 ? 'warning' : 'default'}
              onClick={() => setFilterDringlichkeit(f => f === 'dringend' ? null : 'dringend')}
              active={filterDringlichkeit === 'dringend'}
            />
            <StatStripItem
              title={tx('Offen')}
              value={offeneAnfragen.length}
              icon={<IconMapPin size={16} />}
              tone="default"
              onClick={() => setFilterDringlichkeit(null)}
              active={filterDringlichkeit === null}
            />
            <StatStripItem
              title={tx('Erledigt')}
              value={erledigte}
              icon={<IconCircleCheck size={16} />}
              tone={erledigte > 0 ? 'success' : 'default'}
            />
          </StatStrip>
        }
        aside={<>
          <WorkList
            title={tx('Eingehende Anfragen')}
            items={worklistItems}
            onItemClick={id => {
              const r = serviceanfrage.find(s => s.record_id === id);
              if (r) crud.serviceanfrage.openDetail(r);
            }}
            empty={{
              text: offeneAnfragen.length === 0
                ? tx('Keine offenen Anfragen — ruhiger Tag!')
                : tx('Kein Ergebnis für diesen Filter.'),
              action: {
                label: tx('Anfrage erfassen'),
                onClick: () => crud.serviceanfrage.openCreate({}),
              },
            }}
          />
          <WorkList
            title={tx('Laufende Aufträge')}
            items={auftraegeItems}
            onItemClick={id => {
              const a = auftragsverwaltung.find(x => x.record_id === id);
              if (a) crud.auftragsverwaltung.openDetail(a);
            }}
            empty={{
              text: tx('Keine offenen Aufträge.'),
              action: {
                label: tx('Auftrag anlegen'),
                onClick: () => crud.auftragsverwaltung.openCreate({}),
              },
            }}
          />
        </>}
        primary={
          <MapWidget
            markers={markers}
            legend={[
              { label: tx('Notfall'), tone: 'destructive' },
              { label: tx('Dringend'), tone: 'warning' },
              { label: tx('Normal'), tone: 'primary' },
              { label: tx('Nicht dringend'), tone: 'default' },
              { label: tx('Erledigt'), tone: 'success' },
            ]}
            onMarkerClick={marker => {
              const id = marker.id.split(':')[1];
              const r = serviceanfrage.find(s => s.record_id === id);
              if (r) crud.serviceanfrage.openDetail(r);
            }}
            onMapPointClick={(_point) => {
              crud.serviceanfrage.openCreate({});
            }}
          />
        }
      />

      {crud.surfaces}
    </div>
  );
}
