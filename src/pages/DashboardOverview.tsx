import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { lookupKey } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';
import { MapWidget, type MapMarker, type MapTone } from '@/components/widgets/MapWidget';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { IconAlertTriangle, IconBolt, IconCheck, IconMapPin, IconPlus } from '@tabler/icons-react';

function toneForDringlichkeit(key: string | undefined): KanbanTone {
  if (key === 'notfall') return 'destructive';
  if (key === 'dringend') return 'warning';
  if (key === 'normal') return 'primary';
  return 'default';
}

function mapToneForDringlichkeit(key: string | undefined): MapTone {
  if (key === 'notfall') return 'destructive';
  if (key === 'dringend') return 'warning';
  if (key === 'normal') return 'primary';
  return 'default';
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    serviceanfrage, auftragsverwaltung,
    setServiceanfrage,
    loading, error, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'serviceanfrage') {
        const anfrage = serviceanfrage.find(a => a.record_id === top.record.record_id);
        if (!anfrage) return undefined;
        const auftragsEntry = auftragsverwaltung.find(a => extractRecordId(a.fields.anfrage) === anfrage.record_id);
        if (auftragsEntry?.fields.erledigt) return undefined;
        if (auftragsEntry) {
          return {
            label: tx('Als erledigt markieren'),
            onClick: async () => {
              const prev = auftragsEntry.fields.erledigt;
              try {
                await LivingAppsService.updateAuftragsverwaltungEntry(auftragsEntry.record_id, {
                  erledigt: true,
                  erledigungsdatum: format(new Date(), 'yyyy-MM-dd'),
                });
                undoToast(tx('Auftrag als erledigt markiert'), async () => {
                  await LivingAppsService.updateAuftragsverwaltungEntry(auftragsEntry.record_id, { erledigt: prev });
                  fetchAll();
                });
                fetchAll();
              } catch {
                fetchAll();
              }
            },
          };
        }
        return {
          label: tx('Auftrag anlegen'),
          onClick: () => {
            crud.auftragsverwaltung.openCreate({
              anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, anfrage.record_id),
            });
          },
        };
      }
      if (top.type === 'auftragsverwaltung') {
        const entry = auftragsverwaltung.find(a => a.record_id === top.record.record_id);
        if (!entry || entry.fields.erledigt) return undefined;
        return {
          label: tx('Als erledigt markieren'),
          onClick: async () => {
            try {
              await LivingAppsService.updateAuftragsverwaltungEntry(entry.record_id, {
                erledigt: true,
                erledigungsdatum: format(new Date(), 'yyyy-MM-dd'),
              });
              undoToast(tx('Auftrag als erledigt markiert'), async () => {
                await LivingAppsService.updateAuftragsverwaltungEntry(entry.record_id, { erledigt: false });
                fetchAll();
              });
              fetchAll();
            } catch {
              fetchAll();
            }
          },
        };
      }
      return undefined;
    },
  });

  const enrichedAuftragsverwaltung = crud.enriched.auftragsverwaltung;

  const clock = useClock();
  const [filterKey, setFilterKey] = useState<string | null>(null);

  // Kanban: Dringlichkeit als Spaltenachse für offene Anfragen
  const COLUMNS = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? []).map(o => ({
      key: o.key,
      label: o.label,
    })).reverse(), // Notfall first
    []
  );

  // Erledigte IDs (für useMemo-Dependencies nötig)
  const erledigteAnfrageIdsMemo = useMemo(() => new Set(
    auftragsverwaltung
      .filter(a => a.fields.erledigt && a.fields.anfrage)
      .map(a => extractRecordId(a.fields.anfrage))
      .filter(Boolean) as string[]
  ), [auftragsverwaltung]);

  const offeneAnfragenMemo = useMemo(
    () => serviceanfrage.filter(a => !erledigteAnfrageIdsMemo.has(a.record_id)),
    [serviceanfrage, erledigteAnfrageIdsMemo]
  );

  const cards = useMemo<KanbanCard[]>(
    () => offeneAnfragenMemo.map(a => {
      const dKey = lookupKey(a.fields.dringlichkeit) ?? '';
      const name = [a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
      const ort = [a.fields.strasse, a.fields.hausnummer, a.fields.ort].filter(Boolean).join(' ');
      return {
        id: `anfrage:${a.record_id}`,
        column: dKey || (COLUMNS[COLUMNS.length - 1]?.key ?? ''),
        title: name,
        subtitle: ort || a.fields.problembeschreibung?.slice(0, 60),
        tone: toneForDringlichkeit(dKey),
      };
    }),
    [offeneAnfragenMemo, COLUMNS]
  );

  // Karte: Anfragen mit Geo-Koordinaten
  const markers = useMemo<MapMarker[]>(
    () => serviceanfrage.flatMap(a => {
      const geo = a.fields.einsatzort_geo;
      if (!geo?.lat || !geo?.long) return [];
      const dKey = lookupKey(a.fields.dringlichkeit);
      const name = [a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
      const erledigt = erledigteAnfrageIdsMemo.has(a.record_id);
      return [{
        id: `anfrage:${a.record_id}`,
        lat: geo.lat,
        long: geo.long,
        title: name,
        subtitle: geo.info || [a.fields.strasse, a.fields.hausnummer, a.fields.ort].filter(Boolean).join(' '),
        tone: erledigt ? ('default' as MapTone) : mapToneForDringlichkeit(dKey),
        icon: 'tool' as const,
      }];
    }),
    [serviceanfrage, erledigteAnfrageIdsMemo]
  );

  // ─── All hooks ABOVE here ───────────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: plain derivations only (nothing a hook above reads) ──

  const erledigteAnfrageIds = erledigteAnfrageIdsMemo;
  const offeneAnfragen = offeneAnfragenMemo;
  const notfaelle = offeneAnfragen.filter(a => lookupKey(a.fields.dringlichkeit) === 'notfall');
  const today = format(clock, 'yyyy-MM-dd');
  const neueHeute = serviceanfrage.filter(a => a.createdat.slice(0, 10) === today);

  // Kontextzeile
  const notfallNames = notfaelle.map(a =>
    [a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ')
  );
  const kontextzeile = notfaelle.length > 0
    ? tx`${namen(notfallNames)} — Notfall-Einsatz ausstehend!`
    : offeneAnfragen.length > 0
    ? tx`${offeneAnfragen.length} offene Anfragen warten auf Bearbeitung.`
    : tx('Alle Aufträge erledigt — gut gemacht!');

  // Erledigt-Helper
  const markErledigt = async (anfrageId: string) => {
    const existing = auftragsverwaltung.find(a => extractRecordId(a.fields.anfrage) === anfrageId);
    if (existing) {
      const prev = existing.fields.erledigt;
      try {
        await LivingAppsService.updateAuftragsverwaltungEntry(existing.record_id, {
          erledigt: true,
          erledigungsdatum: format(clock, 'yyyy-MM-dd'),
        });
        undoToast(tx('Als erledigt markiert'), async () => {
          await LivingAppsService.updateAuftragsverwaltungEntry(existing.record_id, { erledigt: prev });
          fetchAll();
        });
        fetchAll();
      } catch {
        fetchAll();
      }
    } else {
      try {
        await LivingAppsService.createAuftragsverwaltungEntry({
          anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, anfrageId),
          erledigt: true,
          erledigungsdatum: format(clock, 'yyyy-MM-dd'),
        });
        undoToast(tx('Als erledigt markiert'), () => {
          fetchAll();
        });
        fetchAll();
      } catch {
        fetchAll();
      }
    }
  };

  // Card move: Dringlichkeit ändern per Drag
  const moveCard = async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    setServiceanfrage(prev =>
      prev.map(a =>
        a.record_id === rid
          ? { ...a, fields: { ...a.fields, dringlichkeit: lookupOption('serviceanfrage', 'dringlichkeit', newColumn) } }
          : a
      )
    );
    try {
      await LivingAppsService.updateServiceanfrageEntry(rid, { dringlichkeit: newColumn });
      undoToast(
        tx`Dringlichkeit geändert`,
      );
    } catch {
      fetchAll();
    }
  };

  const heroAnfrage = notfaelle[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {gruss(clock)} {/* i18n-exempt */}
        </h1>
        <p className="mt-1 text-muted-foreground">{kontextzeile}</p>
        <div className="mt-3">
          <button
            onClick={() => crud.serviceanfrage.openCreate({})}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <IconPlus size={16} className="shrink-0" />
            {tx('Neue Anfrage')}
          </button>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={heroAnfrage && (
          <HeroBanner
            icon={<IconBolt size={18} />}
            action={{
              label: tx('Erledigt melden'),
              onClick: () => markErledigt(heroAnfrage.record_id),
            }}
          >
            <b>{namen(notfallNames)}</b>{' '}
            {notfaelle.length === 1
              ? tx`— Notfall-Einsatz! Sofort reagieren.`
              : tx`— ${notfaelle.length} Notfälle gleichzeitig offen.`
            }
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offen')}
              value={offeneAnfragen.length}
              icon={<IconAlertTriangle size={16} className="shrink-0" />}
              tone={offeneAnfragen.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilterKey(f => f ? null : 'notfall')}
              active={filterKey === 'notfall'}
            />
            <StatStripItem
              title={tx('Notfälle')}
              value={notfaelle.length}
              icon={<IconBolt size={16} className="shrink-0" />}
              tone={notfaelle.length > 0 ? 'destructive' : 'default'}
              onClick={() => setFilterKey(f => f === 'notfall' ? null : 'notfall')}
              active={filterKey === 'notfall'}
            />
            <StatStripItem
              title={tx('Heute neu')}
              value={neueHeute.length}
              icon={<IconMapPin size={16} className="shrink-0" />}
              tone={neueHeute.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Erledigt')}
              value={erledigteAnfrageIds.size}
              icon={<IconCheck size={16} className="shrink-0" />}
              tone="success"
            />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            cards={filterKey ? cards.filter(c => c.column === filterKey) : cards}
            columns={COLUMNS}
            defaultCollapsed={['nicht_dringend']}
            onCardClick={card => {
              const rid = card.id.split(':')[1];
              const rec = serviceanfrage.find(a => a.record_id === rid);
              if (rec) crud.serviceanfrage.openDetail(rec);
            }}
            onCardMove={moveCard}
            onAddCard={column => {
              crud.serviceanfrage.openCreate({ dringlichkeit: column });
            }}
          />
        }
        aside={
          <>
            <MapWidget
              markers={markers}
              onMarkerClick={marker => {
                const rid = marker.id.split(':')[1];
                const rec = serviceanfrage.find(a => a.record_id === rid);
                if (rec) crud.serviceanfrage.openDetail(rec);
              }}
              onMapPointClick={({ lat, long }) => {
                crud.serviceanfrage.openCreate({ einsatzort_geo: { lat, long } });
              }}
              legend={[
                { label: tx('Notfall'), tone: 'destructive' },
                { label: tx('Dringend'), tone: 'warning' },
                { label: tx('Normal'), tone: 'primary' },
                { label: tx('Erledigt'), tone: 'default' },
              ]}
            />
            <WorkList
              title={tx('Offene Notfälle & Dringende')}
              items={offeneAnfragen
                .filter(a => ['notfall', 'dringend'].includes(lookupKey(a.fields.dringlichkeit) ?? ''))
                .sort((a, b) => {
                  const order = ['notfall', 'dringend'];
                  return order.indexOf(lookupKey(a.fields.dringlichkeit) ?? '') - order.indexOf(lookupKey(b.fields.dringlichkeit) ?? '');
                })
                .slice(0, 8)
                .map(a => {
                  const name = [a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
                  const dKey = lookupKey(a.fields.dringlichkeit);
                  const dLabel = a.fields.dringlichkeit?.label ?? '';
                  return {
                    id: a.record_id,
                    title: name,
                    secondLine: (
                      <span className="flex gap-2 flex-wrap">
                        <span className={dKey === 'notfall' ? 'font-semibold text-destructive' : 'font-medium text-amber-600'}>
                          {dLabel}
                        </span>
                        {a.fields.ort && (
                          <span className="text-muted-foreground">{a.fields.ort}</span>
                        )}
                      </span>
                    ),
                    action: {
                      label: tx('✓ Erledigt'),
                      onClick: () => markErledigt(a.record_id),
                    },
                  };
                })
              }
              onItemClick={id => {
                const rec = serviceanfrage.find(a => a.record_id === id);
                if (rec) crud.serviceanfrage.openDetail(rec);
              }}
              empty={{
                text: tx('Keine dringenden Anfragen — alles im Griff!'),
                action: {
                  label: tx('Neue Anfrage erfassen'),
                  onClick: () => crud.serviceanfrage.openCreate({}),
                },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
