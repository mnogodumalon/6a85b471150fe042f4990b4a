import { useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import type { GeoLocation } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { MapWidget, type MapMarker, type MapTone } from '@/components/widgets/MapWidget';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { reverseGeocodeDetailed } from '@/lib/ai';
import {
  IconAlertTriangle,
  IconCheck,
  IconMapPin,
  IconClipboardList,
  IconBolt,
} from '@tabler/icons-react';

function toneForDringlichkeit(key: string | undefined): MapTone {
  if (key === 'notfall') return 'destructive';
  if (key === 'dringend') return 'warning';
  if (key === 'normal') return 'primary';
  return 'default';
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    serviceanfrage,
    auftragsverwaltung,
    serviceanfrageMap,
    loading, error, fetchAll,
    setAuftragsverwaltung,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'auftragsverwaltung') {
        const rec = top.record;
        if (!rec.fields.erledigt) {
          return {
            label: tx('Als erledigt markieren'),
            onClick: async () => {
              const prev = [...auftragsverwaltung];
              setAuftragsverwaltung(auftragsverwaltung.map(a =>
                a.record_id === rec.record_id
                  ? { ...a, fields: { ...a.fields, erledigt: true, erledigungsdatum: format(clock, 'yyyy-MM-dd') } }
                  : a
              ));
              try {
                await LivingAppsService.updateAuftragsverwaltungEntry(rec.record_id, {
                  erledigt: true,
                  erledigungsdatum: format(clock, 'yyyy-MM-dd'),
                });
                undoToast(tx('Auftrag als erledigt markiert'), async () => {
                  setAuftragsverwaltung(prev);
                  await LivingAppsService.updateAuftragsverwaltungEntry(rec.record_id, {
                    erledigt: false,
                    erledigungsdatum: undefined,
                  });
                });
              } catch {
                setAuftragsverwaltung(prev);
                await fetchAll();
              }
            },
          };
        }
      }
      return undefined;
    },
  });

  const enrichedAuftragsverwaltung = crud.enriched.auftragsverwaltung;

  // ─── Derived state ───────────────────────────────────────────────────────
  const todayKey = format(clock, 'yyyy-MM-dd');

  const notfallAnfragen = useMemo(
    () => serviceanfrage.filter(r => lookupKey(r.fields.dringlichkeit) === 'notfall'),
    [serviceanfrage]
  );

  const offeneAuftraege = useMemo(
    () => enrichedAuftragsverwaltung.filter(a => !a.fields.erledigt),
    [enrichedAuftragsverwaltung]
  );

  const heuteErledigt = useMemo(
    () => enrichedAuftragsverwaltung.filter(
      a => a.fields.erledigt && a.fields.erledigungsdatum?.slice(0, 10) === todayKey
    ),
    [enrichedAuftragsverwaltung, todayKey]
  );

  const neuAnfragen = useMemo(
    () => serviceanfrage.filter(r => r.createdat?.slice(0, 10) === todayKey),
    [serviceanfrage, todayKey]
  );

  // Auftraege sorted by urgency of linked anfrage
  const URGENCY_ORDER: Record<string, number> = {
    notfall: 0, dringend: 1, normal: 2, nicht_dringend: 3,
  };
  const sortedOffene = useMemo(() => {
    return [...offeneAuftraege].sort((a, b) => {
      const anfrageA = serviceanfrageMap.get(a.fields.anfrage?.split('/').pop() ?? '');
      const anfrageB = serviceanfrageMap.get(b.fields.anfrage?.split('/').pop() ?? '');
      const keyA = lookupKey(anfrageA?.fields.dringlichkeit) ?? 'nicht_dringend';
      const keyB = lookupKey(anfrageB?.fields.dringlichkeit) ?? 'nicht_dringend';
      return (URGENCY_ORDER[keyA] ?? 3) - (URGENCY_ORDER[keyB] ?? 3);
    });
  }, [offeneAuftraege, serviceanfrageMap]);

  // New requests without an Auftrag yet
  const linkedAnfrageIds = useMemo(() => {
    const ids = new Set<string>();
    auftragsverwaltung.forEach(a => {
      const id = a.fields.anfrage?.split('/').pop();
      if (id) ids.add(id);
    });
    return ids;
  }, [auftragsverwaltung]);

  const unbearbeiteteAnfragen = useMemo(
    () => serviceanfrage.filter(r => !linkedAnfrageIds.has(r.record_id)),
    [serviceanfrage, linkedAnfrageIds]
  );

  const markers = useMemo<MapMarker[]>(
    () => serviceanfrage.flatMap(r => {
      const geo: GeoLocation | undefined = r.fields.einsatzort_geo;
      if (!geo) return [];
      const dKey = lookupKey(r.fields.dringlichkeit);
      const hasAuftrag = linkedAnfrageIds.has(r.record_id);
      return [{
        id: `serviceanfrage:${r.record_id}`,
        lat: geo.lat,
        long: geo.long,
        title: [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt'),
        subtitle: [r.fields.strasse, r.fields.hausnummer, r.fields.ort].filter(Boolean).join(' ') || geo.info,
        tone: hasAuftrag ? 'success' : toneForDringlichkeit(dKey),
        icon: 'tool' as const,
      }];
    }),
    [serviceanfrage, linkedAnfrageIds]
  );

  const erledigenAuftrag = useCallback(async (auftragId: string) => {
    const prev = [...auftragsverwaltung];
    setAuftragsverwaltung(auftragsverwaltung.map(a =>
      a.record_id === auftragId
        ? { ...a, fields: { ...a.fields, erledigt: true, erledigungsdatum: format(clock, 'yyyy-MM-dd') } }
        : a
    ));
    try {
      await LivingAppsService.updateAuftragsverwaltungEntry(auftragId, {
        erledigt: true,
        erledigungsdatum: format(clock, 'yyyy-MM-dd'),
      });
      undoToast(tx('Auftrag erledigt'), async () => {
        setAuftragsverwaltung(prev);
        await LivingAppsService.updateAuftragsverwaltungEntry(auftragId, {
          erledigt: false,
          erledigungsdatum: undefined,
        });
      });
    } catch {
      setAuftragsverwaltung(prev);
      await fetchAll();
    }
  }, [auftragsverwaltung, setAuftragsverwaltung, clock, fetchAll]);

  const auftragAnlegen = useCallback(async (anfrageId: string) => {
    try {
      await LivingAppsService.createAuftragsverwaltungEntry({
        anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, anfrageId),
        erledigt: false,
      });
      undoToast(tx('Auftrag angelegt'));
      await fetchAll();
    } catch {
      await fetchAll();
    }
  }, [fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Context line ───────────────────────────────────────────────────────
  const kundenHeute = neuAnfragen
    .map(r => [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' '))
    .filter(Boolean);

  const contextLine = serviceanfrage.length === 0
    ? tx('Noch keine Anfragen. Richte deine App ein und leg los.')
    : offeneAuftraege.length > 0
      ? kundenHeute.length > 0
        ? tx`Heute neu: ${namen(kundenHeute)} — ${offeneAuftraege.length} offene Aufträge warten.`
        : tx`${offeneAuftraege.length} offene Aufträge — ${unbearbeiteteAnfragen.length} Anfragen noch ohne Auftrag.`
      : tx('Alle Aufträge erledigt – super gemacht!');

  const DRINGLICHKEIT_OPTS = LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {gruss(clock)}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">{contextLine}</p>
        </div>
        <button
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => crud.serviceanfrage.openCreate({})}
        >
          <IconClipboardList size={16} className="shrink-0" />
          {tx('Neue Anfrage')}
        </button>
      </div>

      <DashboardGrid
        variant="split"
        hero={
          notfallAnfragen.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: tx('Auftrag anlegen'),
                onClick: () => {
                  const first = notfallAnfragen.find(r => !linkedAnfrageIds.has(r.record_id));
                  if (first) void auftragAnlegen(first.record_id);
                  else crud.serviceanfrage.openDetail(notfallAnfragen[0]);
                },
              }}
            >
              <b>{namen(notfallAnfragen.map(r => [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ')))}</b>
              {tx` – Notfall-Einsatz erforderlich!`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Neue heute')}
              value={neuAnfragen.length}
              icon={<IconClipboardList size={16} className="shrink-0" />}
              tone={neuAnfragen.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Offen')}
              value={offeneAuftraege.length}
              icon={<IconBolt size={16} className="shrink-0" />}
              tone={offeneAuftraege.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Heute erledigt')}
              value={heuteErledigt.length}
              icon={<IconCheck size={16} className="shrink-0" />}
              tone={heuteErledigt.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Anfragen gesamt')}
              value={serviceanfrage.length}
              icon={<IconMapPin size={16} className="shrink-0" />}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          serviceanfrage.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card p-12 text-center">
              <IconMapPin size={48} className="text-muted-foreground" stroke={1.5} />
              <div>
                <p className="font-semibold text-foreground">{tx('Noch keine Anfragen')}</p>
                <p className="text-sm text-muted-foreground mt-1">{tx('Leg die erste Anfrage an und sehe sie auf der Karte.')}</p>
              </div>
              <button
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                onClick={() => crud.serviceanfrage.openCreate({})}
              >
                <IconClipboardList size={16} className="shrink-0" />
                {tx('Erste Anfrage anlegen')}
              </button>
            </div>
          ) : (
            <MapWidget
              markers={markers}
              legend={[
                { label: tx('Notfall'), tone: 'destructive' },
                { label: tx('Dringend'), tone: 'warning' },
                { label: tx('Normal'), tone: 'primary' },
                { label: tx('Nicht dringend'), tone: 'default' },
                { label: tx('Auftrag angelegt'), tone: 'success' },
              ]}
              onMarkerClick={marker => {
                const id = marker.id.split(':')[1] ?? '';
                const rec = serviceanfrage.find(r => r.record_id === id);
                if (rec) crud.serviceanfrage.openDetail(rec);
              }}
              onMapPointClick={async ({ lat, long }) => {
                const addr = await reverseGeocodeDetailed(lat, long);
                crud.serviceanfrage.openCreate({
                  einsatzort_geo: { lat, long, info: addr.display },
                  strasse: addr.road,
                  hausnummer: addr.houseNumber,
                  plz: addr.postcode,
                  ort: addr.city,
                });
              }}
            />
          )
        }
        aside={
          <>
            <WorkList
              title={tx('Offene Aufträge')}
              items={sortedOffene.map(a => {
                const anfrage = serviceanfrageMap.get(a.fields.anfrage?.split('/').pop() ?? '');
                const dKey = lookupKey(anfrage?.fields.dringlichkeit);
                const dOpt = DRINGLICHKEIT_OPTS.find(o => o.key === dKey);
                const name = a.anfrageName || anfrage?.fields.ort || tx('Unbekannte Anfrage');
                const ort = anfrage ? [anfrage.fields.strasse, anfrage.fields.hausnummer, anfrage.fields.ort].filter(Boolean).join(' ') : '';
                return {
                  id: a.record_id,
                  title: name,
                  secondLine: (
                    <>
                      {dKey === 'notfall' && (
                        <span className="font-medium text-destructive">{dOpt?.label ?? dKey}</span>
                      )}
                      {dKey === 'dringend' && (
                        <span className="font-medium text-amber-600">{dOpt?.label ?? dKey}</span>
                      )}
                      {dKey === 'normal' && (
                        <span className="text-muted-foreground">{dOpt?.label ?? dKey}</span>
                      )}
                      {(!dKey || dKey === 'nicht_dringend') && (
                        <span className="text-muted-foreground">{dOpt?.label ?? tx('Nicht dringend')}</span>
                      )}
                      {ort && <span className="text-muted-foreground"> · {ort}</span>}
                    </>
                  ),
                  action: {
                    label: tx('✓ Erledigt'),
                    onClick: () => void erledigenAuftrag(a.record_id),
                  },
                };
              })}
              onItemClick={id => {
                const a = enrichedAuftragsverwaltung.find(r => r.record_id === id);
                if (a) crud.auftragsverwaltung.openDetail(a);
              }}
              empty={{
                text: heuteErledigt.length > 0
                  ? tx('Alle Aufträge erledigt – guter Tag!')
                  : tx('Noch keine Aufträge. Anfragen anlegen oder zuordnen.'),
                action: { label: tx('Neue Anfrage'), onClick: () => crud.serviceanfrage.openCreate({}) },
              }}
            />
            <WorkList
              title={tx('Neue Anfragen ohne Auftrag')}
              items={unbearbeiteteAnfragen.map(r => {
                const dKey = lookupKey(r.fields.dringlichkeit);
                const dOpt = DRINGLICHKEIT_OPTS.find(o => o.key === dKey);
                const name = [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
                const ort = [r.fields.strasse, r.fields.hausnummer, r.fields.ort].filter(Boolean).join(' ');
                return {
                  id: r.record_id,
                  title: name,
                  secondLine: (
                    <>
                      {dKey === 'notfall' && (
                        <span className="font-medium text-destructive">{dOpt?.label ?? dKey}</span>
                      )}
                      {(dKey === 'dringend') && (
                        <span className="font-medium text-amber-600">{dOpt?.label ?? dKey}</span>
                      )}
                      {dKey === 'normal' && (
                        <span className="text-muted-foreground">{dOpt?.label ?? dKey}</span>
                      )}
                      {(!dKey || dKey === 'nicht_dringend') && (
                        <span className="text-muted-foreground">{dOpt?.label ?? tx('Nicht dringend')}</span>
                      )}
                      {ort && <span className="text-muted-foreground"> · {ort}</span>}
                    </>
                  ),
                  action: {
                    label: tx('Auftrag anlegen'),
                    onClick: () => void auftragAnlegen(r.record_id),
                  },
                };
              })}
              onItemClick={id => {
                const r = serviceanfrage.find(s => s.record_id === id);
                if (r) crud.serviceanfrage.openDetail(r);
              }}
              empty={{
                text: tx('Alle Anfragen sind bereits als Aufträge erfasst.'),
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
