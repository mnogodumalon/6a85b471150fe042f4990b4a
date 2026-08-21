import { useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import type { Serviceanfrage } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { lookupKey, formatDate } from '@/lib/formatters';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard, KanbanColumn, KanbanTone } from '@/components/widgets/KanbanWidget';
import { MapWidget } from '@/components/widgets/MapWidget';
import type { MapMarker } from '@/components/widgets/MapWidget';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, appLabel } from '@/i18n';
import { IconAlertTriangle, IconPlus, IconCheck, IconMapPin, IconPhone, IconBolt } from '@tabler/icons-react';

// Dringlichkeit → Kanban-Ton
function toneForDringlichkeit(key: string | undefined): KanbanTone {
  if (key === 'notfall') return 'destructive';
  if (key === 'dringend') return 'warning';
  if (key === 'normal') return 'primary';
  return 'default';
}

// Dringlichkeit → Map-Ton
function mapToneForDringlichkeit(key: string | undefined): MapMarker['tone'] {
  if (key === 'notfall') return 'destructive';
  if (key === 'dringend') return 'warning';
  if (key === 'normal') return 'primary';
  return 'default';
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    serviceanfrage, setServiceanfrage,
    auftragsverwaltung, setAuftragsverwaltung,
    loading, error, fetchAll,
  } = data;

  const clock = useClock();
  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'auftragsverwaltung') {
        const auftrag = auftragsverwaltung.find(a => a.record_id === top.record.record_id);
        if (auftrag && !auftrag.fields.erledigt) {
          return {
            label: tx('Als erledigt markieren'),
            onClick: () => handleMarkErledigt(top.record.record_id),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedAuftragsverwaltung = crud.enriched.auftragsverwaltung;

  // Dringlichkeit-Kanban-Spalten (im Component-Body, nie module-scope)
  const kanbanColumns = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? []).map(o => ({
      key: o.key,
      label: o.label,
      tone: toneForDringlichkeit(o.key),
    })),
    [],
  );

  // Kanban-Karten: Serviceanfragen → nach Dringlichkeit
  const kanbanCards = useMemo<KanbanCard[]>(
    () => serviceanfrage.map(r => {
      const dk = lookupKey(r.fields.dringlichkeit) ?? 'nicht_dringend';
      const name = [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
      return {
        id: `serviceanfrage:${r.record_id}`,
        column: dk,
        title: name,
        subtitle: [r.fields.strasse, r.fields.hausnummer, r.fields.ort].filter(Boolean).join(' '),
        tone: toneForDringlichkeit(dk),
      };
    }),
    [serviceanfrage],
  );

  // Map-Marker: Anfragen mit Geo-Koordinaten
  const mapMarkers = useMemo<MapMarker[]>(
    () => serviceanfrage.flatMap(r => {
      const geo = r.fields.einsatzort_geo;
      if (!geo?.lat || !geo?.long) return [];
      const dk = lookupKey(r.fields.dringlichkeit);
      const name = [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
      return [{
        id: `serviceanfrage:${r.record_id}`,
        lat: geo.lat,
        long: geo.long,
        title: name,
        subtitle: [r.fields.strasse, r.fields.hausnummer, r.fields.ort].filter(Boolean).join(' '),
        tone: mapToneForDringlichkeit(dk),
      }];
    }),
    [serviceanfrage],
  );

  // Notfälle und dringende Anfragen
  const notfaelle = useMemo(
    () => serviceanfrage.filter(r => lookupKey(r.fields.dringlichkeit) === 'notfall'),
    [serviceanfrage],
  );

  // Offene Aufträge (nicht erledigt)
  const offeneAuftraege = useMemo(
    () => enrichedAuftragsverwaltung.filter(a => !a.fields.erledigt),
    [enrichedAuftragsverwaltung],
  );

  // Heute erledigte Aufträge
  const heuteErledigt = useMemo(() => {
    const today = format(clock, 'yyyy-MM-dd');
    return auftragsverwaltung.filter(a => a.fields.erledigt && a.fields.erledigungsdatum === today);
  }, [auftragsverwaltung, clock]);

  // Kontext-Zeile
  const kontextzeile = useMemo(() => {
    if (notfaelle.length > 0) {
      const nms = namen(notfaelle.map(r => [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ')));
      return tx`Notfall-Einsatz: ${nms} wartet auf dich.`;
    }
    if (offeneAuftraege.length > 0) {
      const nms = namen(offeneAuftraege.map(a => a.anfrageName || tx('Auftrag')));
      return tx`Offene Aufträge: ${nms}.`;
    }
    if (serviceanfrage.length === 0) {
      return tx('Noch keine Anfragen eingegangen — alles ruhig.');
    }
    return tx`${serviceanfrage.length} Anfragen im System, ${heuteErledigt.length} heute erledigt.`;
  }, [notfaelle, offeneAuftraege, serviceanfrage.length, heuteErledigt.length]);

  // Auftrag als erledigt markieren (optimistisch)
  const handleMarkErledigt = useCallback(async (recordId: string) => {
    const auftrag = auftragsverwaltung.find(a => a.record_id === recordId);
    if (!auftrag) return;
    const today = format(clock, 'yyyy-MM-dd');
    const prev = { ...auftrag, fields: { ...auftrag.fields } };

    setAuftragsverwaltung(prev2 =>
      prev2.map(a =>
        a.record_id === recordId
          ? { ...a, fields: { ...a.fields, erledigt: true, erledigungsdatum: today } }
          : a,
      ),
    );

    const kundenname = [auftrag.fields.anfrage ? enrichedAuftragsverwaltung.find(e => e.record_id === recordId)?.anfrageName : ''].filter(Boolean).join('') || tx('Auftrag');
    undoToast(
      tx`${kundenname} — als erledigt markiert`,
      async () => {
        setAuftragsverwaltung(prev2 =>
          prev2.map(a =>
            a.record_id === recordId ? prev : a,
          ),
        );
        try {
          await LivingAppsService.updateAuftragsverwaltungEntry(recordId, {
            erledigt: prev.fields.erledigt ?? false,
            erledigungsdatum: prev.fields.erledigungsdatum,
          });
        } catch {
          await fetchAll();
        }
      },
    );

    try {
      await LivingAppsService.updateAuftragsverwaltungEntry(recordId, {
        erledigt: true,
        erledigungsdatum: today,
      });
    } catch {
      setAuftragsverwaltung(prev2 =>
        prev2.map(a => a.record_id === recordId ? prev : a),
      );
      await fetchAll();
    }
  }, [auftragsverwaltung, enrichedAuftragsverwaltung, clock, setAuftragsverwaltung, fetchAll]);

  // Notfall-Anfrage öffnen (Hero-Action: direkt anrufen / Detail öffnen)
  const handleHeroAction = useCallback(() => {
    if (notfaelle.length > 0) {
      crud.serviceanfrage.openDetail(notfaelle[0]);
    }
  }, [notfaelle, crud]);

  // Karte verschieben = Dringlichkeit ändern (optimistisch)
  const handleCardMove = useCallback(async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const prev = serviceanfrage.find(r => r.record_id === rid);
    if (!prev) return;

    setServiceanfrage(ps =>
      ps.map(r =>
        r.record_id === rid
          ? { ...r, fields: { ...r.fields, dringlichkeit: lookupOption('serviceanfrage', 'dringlichkeit', newColumn) } }
          : r,
      ),
    );
    undoToast(
      tx`Dringlichkeit geändert`,
      async () => {
        setServiceanfrage(ps =>
          ps.map(r => r.record_id === rid ? prev : r),
        );
        try {
          await LivingAppsService.updateServiceanfrageEntry(rid, { dringlichkeit: lookupKey(prev.fields.dringlichkeit) });
        } catch {
          await fetchAll();
        }
      },
    );

    try {
      await LivingAppsService.updateServiceanfrageEntry(rid, { dringlichkeit: newColumn });
    } catch {
      setServiceanfrage(ps =>
        ps.map(r => r.record_id === rid ? prev : r),
      );
      await fetchAll();
    }
  }, [serviceanfrage, setServiceanfrage, fetchAll]);

  // Hooks MUST all be above early returns ↑↑↑
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Derivations only below ───

  const hasNotfall = notfaelle.length > 0;

  return (
    <div className="space-y-6">
      {/* Seiten-Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {gruss(clock)}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{kontextzeile}</p>
        </div>
        <button
          onClick={() => crud.serviceanfrage.openCreate({})}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0"
        >
          <IconPlus size={16} className="shrink-0" />
          {tx('Neue Anfrage')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          hasNotfall && (
            <HeroBanner
              icon={<IconBolt size={18} />}
              action={{ label: tx('Anfrage öffnen'), onClick: handleHeroAction }}
            >
              <b>{namen(notfaelle.map(r => [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ')))}</b>
              {tx` meldet einen Notfall — sofortiger Einsatz nötig.`}
            </HeroBanner>
          )
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Alle Anfragen')}
              value={serviceanfrage.length}
              icon={<IconMapPin size={16} />}
              tone="default"
            />
            <StatStripItem
              title={tx('Notfall')}
              value={notfaelle.length}
              icon={<IconAlertTriangle size={16} />}
              tone={notfaelle.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={tx('Offene Aufträge')}
              value={offeneAuftraege.length}
              icon={<IconPhone size={16} />}
              tone={offeneAuftraege.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Heute erledigt')}
              value={heuteErledigt.length}
              icon={<IconCheck size={16} />}
              tone={heuteErledigt.length > 0 ? 'success' : 'default'}
            />
          </StatStrip>
        }
        primary={
          serviceanfrage.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl border border-dashed border-border bg-card">
              <IconBolt size={48} className="text-muted-foreground" stroke={1.5} />
              <div className="text-center">
                <p className="font-semibold text-foreground">{tx('Noch keine Anfragen')}</p>
                <p className="text-sm text-muted-foreground mt-1">{tx('Teile deine Seite mit Kunden — Anfragen erscheinen hier.')}</p>
              </div>
              <button
                onClick={() => crud.serviceanfrage.openCreate({})}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <IconPlus size={16} className="shrink-0" />
                {tx('Erste Anfrage anlegen')}
              </button>
            </div>
          ) : (
            <KanbanWidget
              cards={kanbanCards}
              columns={kanbanColumns}
              onCardClick={card => {
                const rid = card.id.split(':')[1];
                const r = serviceanfrage.find(x => x.record_id === rid);
                if (r) crud.serviceanfrage.openDetail(r);
              }}
              onCardMove={handleCardMove}
              onAddCard={column => crud.serviceanfrage.openCreate({ dringlichkeit: column })}
            />
          )
        }
        aside={
          <>
            <WorkList
              title={tx('Offene Aufträge')}
              items={offeneAuftraege.map(a => ({
                id: a.record_id,
                title: a.anfrageName || appLabel('serviceanfrage'),
                secondLine: (
                  <span className="text-muted-foreground text-xs">
                    {a.fields.erledigungsdatum
                      ? tx`Geplant: ${formatDate(a.fields.erledigungsdatum)}`
                      : tx('Kein Datum geplant')}
                  </span>
                ),
                action: {
                  label: tx('Erledigt'),
                  onClick: () => handleMarkErledigt(a.record_id),
                },
              }))}
              onItemClick={id => {
                const a = auftragsverwaltung.find(x => x.record_id === id);
                if (a) crud.auftragsverwaltung.openDetail(a);
              }}
              empty={{
                text: tx('Alle Aufträge erledigt — gut gemacht!'),
                action: { label: tx('Neuen Auftrag anlegen'), onClick: () => crud.auftragsverwaltung.openCreate({}) },
              }}
            />
            <div className="rounded-2xl overflow-hidden border border-border bg-card">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">{tx('Einsatzorte auf der Karte')}</h3>
              </div>
              <div style={{ minHeight: 260 }}>
                <MapWidget
                  markers={mapMarkers}
                  onMarkerClick={marker => {
                    const rid = marker.id.split(':')[1];
                    const r = serviceanfrage.find(x => x.record_id === rid);
                    if (r) crud.serviceanfrage.openDetail(r);
                  }}
                  onMapPointClick={(_point) => {
                    crud.serviceanfrage.openCreate({});
                  }}
                  legend={[
                    { label: tx('Notfall'), tone: 'destructive' },
                    { label: tx('Dringend'), tone: 'warning' },
                    { label: tx('Normal'), tone: 'primary' },
                    { label: tx('Nicht dringend'), tone: 'default' },
                  ]}
                />
              </div>
            </div>
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
