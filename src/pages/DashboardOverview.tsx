import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { KanbanWidget } from '@/components/widgets/KanbanWidget';
import type { KanbanCard } from '@/components/widgets/KanbanWidget';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { lookupKey } from '@/lib/formatters';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClipboardList,
  IconClock,
  IconBolt,
} from '@tabler/icons-react';

// Dringlichkeitsstufen — als Kanban-Spalten plus "erledigt"
const DRINGLICHKEIT_ORDER = ['notfall', 'dringend', 'normal', 'nicht_dringend'];

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    serviceanfrage,
    auftragsverwaltung,
    serviceanfrageMap,
    loading, error, fetchAll,
    setServiceanfrage,
  } = data;

  const clock = useClock();
  const crud = useEntityCrud(data);
  const enrichedAuftragsverwaltung = crud.enriched.auftragsverwaltung;

  // Filter: welche Dringlichkeitsstufe ist aktiv? null = alle
  const [filterDring, setFilterDring] = useState<string | null>(null);

  // Aufträge nach Anfrage-ID indexieren (für Hub-Lookup)
  const auftragByAnfrageId = useMemo(() => {
    const m = new Map<string, typeof auftragsverwaltung[0]>();
    for (const a of auftragsverwaltung) {
      const id = extractRecordId(a.fields.anfrage ?? '');
      if (id) m.set(id, a);
    }
    return m;
  }, [auftragsverwaltung]);

  // Anfragen ohne zugehörigen Auftrag (noch unbearbeitet)
  const ohneAuftrag = useMemo(
    () => serviceanfrage.filter(r => !auftragByAnfrageId.has(r.record_id)),
    [serviceanfrage, auftragByAnfrageId]
  );

  // Notfall-Anfragen ohne Auftrag = hero-Signal
  const notfaelle = useMemo(
    () => ohneAuftrag.filter(r => lookupKey(r.fields.dringlichkeit) === 'notfall'),
    [ohneAuftrag]
  );

  // Anfragen, die noch keinen erledigten Auftrag haben
  const offeneAnfragen = useMemo(
    () => serviceanfrage.filter(r => {
      const a = auftragByAnfrageId.get(r.record_id);
      return !a || !a.fields.erledigt;
    }),
    [serviceanfrage, auftragByAnfrageId]
  );

  // Erledigte Aufträge
  const erledigte = useMemo(
    () => auftragsverwaltung.filter(a => a.fields.erledigt),
    [auftragsverwaltung]
  );

  // Auftrag anlegen und als erledigt markieren — shared advance helper
  const handleAuftragAnlegen = useCallback(async (anfrage: typeof serviceanfrage[0]) => {
    const snapshot = [...auftragsverwaltung];
    try {
      await LivingAppsService.createAuftragsverwaltungEntry({
        anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, anfrage.record_id),
        erledigt: false,
      });
      undoToast(tx`Auftrag für ${anfrage.fields.vorname ?? ''} ${anfrage.fields.nachname ?? ''} angelegt`);
      await fetchAll();
    } catch {
      data.setAuftragsverwaltung(snapshot);
      await fetchAll();
    }
  }, [auftragsverwaltung, fetchAll, data]);

  // Auftrag als erledigt markieren
  const handleErledigt = useCallback(async (auftrag: typeof auftragsverwaltung[0]) => {
    const prev = auftragsverwaltung.map(a =>
      a.record_id === auftrag.record_id ? { ...a, fields: { ...a.fields, erledigt: true, erledigungsdatum: format(clock, 'yyyy-MM-dd') } } : a
    );
    data.setAuftragsverwaltung(prev);
    try {
      await LivingAppsService.updateAuftragsverwaltungEntry(auftrag.record_id, {
        erledigt: true,
        erledigungsdatum: format(clock, 'yyyy-MM-dd'),
      });
      undoToast(
        tx`Auftrag als erledigt markiert`,
        async () => {
          data.setAuftragsverwaltung(auftragsverwaltung);
          await LivingAppsService.updateAuftragsverwaltungEntry(auftrag.record_id, { erledigt: false, erledigungsdatum: undefined });
        }
      );
    } catch {
      data.setAuftragsverwaltung(auftragsverwaltung);
      await fetchAll();
    }
  }, [auftragsverwaltung, fetchAll, data, clock]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Kanban: Spalten = Dringlichkeitsstufen + "Erledigt"
  const columns = [
    ...(LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? []).map((o: { key: string; label: string }) => ({
      key: o.key,
      label: o.label,
      tone: o.key === 'notfall' ? ('destructive' as const)
        : o.key === 'dringend' ? ('warning' as const)
        : o.key === 'normal' ? ('primary' as const)
        : ('default' as const),
    })).sort((a: { key: string }, b: { key: string }) => DRINGLICHKEIT_ORDER.indexOf(a.key) - DRINGLICHKEIT_ORDER.indexOf(b.key)),
    { key: 'erledigt', label: tx('Erledigt'), tone: 'success' as const },
  ];

  // Kanban-Karten: jede Anfrage = eine Karte
  const cards: KanbanCard[] = serviceanfrage
    .filter(r => filterDring === null || lookupKey(r.fields.dringlichkeit) === filterDring)
    .map(r => {
      const auftrag = auftragByAnfrageId.get(r.record_id);
      const isErledigt = auftrag?.fields.erledigt === true;
      const dring = lookupKey(r.fields.dringlichkeit) ?? 'nicht_dringend';
      const col = isErledigt ? 'erledigt' : dring;
      const name = [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
      const ort = [r.fields.strasse, r.fields.hausnummer, r.fields.ort].filter(Boolean).join(' ');
      return {
        id: `anfrage:${r.record_id}`,
        column: col,
        title: name,
        subtitle: ort || r.fields.problembeschreibung?.slice(0, 60),
        tone: col === 'erledigt' ? 'success' as const
          : dring === 'notfall' ? 'destructive' as const
          : dring === 'dringend' ? 'warning' as const
          : 'default' as const,
      };
    });

  // KPI-Zahlen
  const gesamt = serviceanfrage.length;
  const offen = offeneAnfragen.length;
  const heute = erledigte.filter(a => a.fields.erledigungsdatum === format(clock, 'yyyy-MM-dd')).length;

  // Context-Satz mit Namen der neuesten Anfragen
  const neuesteNamen = ohneAuftrag
    .slice(0, 3)
    .map(r => [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' '))
    .filter(Boolean);

  const contextLine = gesamt === 0
    ? tx('Noch keine Anfragen — richte dein System ein.')
    : offen > 0
      ? neuesteNamen.length > 0
        ? tx`${namen(neuesteNamen)} ${offen > 1 ? tx('warten auf Bearbeitung') : tx('wartet auf Bearbeitung')}.`
        : tx`${String(offen)} offene ${offen === 1 ? tx('Anfrage wartet') : tx('Anfragen warten')}.`
      : tx('Alles erledigt — super Arbeit!');

  return (
    <div className="space-y-6">
      {/* Seitenheader */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {gruss(clock)}
          </h1>
          <p className="text-muted-foreground mt-1">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.serviceanfrage.openCreate({})}
          className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <IconClipboardList size={16} className="shrink-0" />
          {tx('Neue Anfrage')}
        </button>
      </div>

      {gesamt === 0 ? (
        /* Leerer Zustand */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 py-20 gap-4 text-center">
          <IconClipboardList size={48} className="text-muted-foreground" stroke={1.5} />
          <div>
            <p className="font-semibold text-lg">{tx('Noch keine Anfragen')}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {tx('Sobald Kunden eine Anfrage senden, erscheint sie hier.')}
            </p>
          </div>
          <button
            onClick={() => crud.serviceanfrage.openCreate({})}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
          >
            <IconClipboardList size={16} className="shrink-0" />
            {tx('Erste Anfrage manuell aufnehmen')}
          </button>
        </div>
      ) : (
        <DashboardGrid
          variant="wide"
          hero={notfaelle.length > 0 ? (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={{
                label: tx('Auftrag anlegen'),
                onClick: () => handleAuftragAnlegen(notfaelle[0]),
              }}
            >
              <b>{namen(notfaelle.map(r => [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ')))}</b>
              {' '}{notfaelle.length === 1 ? tx('hat einen Notfall gemeldet — sofortiger Einsatz nötig!') : tx('haben Notfälle gemeldet — sofortiger Einsatz nötig!')}
            </HeroBanner>
          ) : undefined}
          kpis={
            <StatStrip>
              <StatStripItem
                title={tx('Offen')}
                value={offen}
                icon={<IconClock size={16} className="shrink-0" />}
                tone={offen > 0 ? 'warning' : 'default'}
                onClick={() => setFilterDring(f => f === '__offen__' ? null : '__offen__')}
                active={filterDring === '__offen__'}
              />
              <StatStripItem
                title={tx('Notfälle')}
                value={notfaelle.length}
                icon={<IconBolt size={16} className="shrink-0" />}
                tone={notfaelle.length > 0 ? 'destructive' : 'default'}
                onClick={() => setFilterDring(f => f === 'notfall' ? null : 'notfall')}
                active={filterDring === 'notfall'}
              />
              <StatStripItem
                title={tx('Heute erledigt')}
                value={heute}
                icon={<IconCircleCheck size={16} className="shrink-0" />}
                tone={heute > 0 ? 'success' : 'default'}
              />
              <StatStripItem
                title={tx('Gesamt')}
                value={gesamt}
                icon={<IconClipboardList size={16} className="shrink-0" />}
              />
            </StatStrip>
          }
          primary={
            <KanbanWidget
              columns={columns}
              cards={cards}
              defaultCollapsed={['erledigt']}
              onCardClick={card => {
                const id = card.id.split(':')[1];
                const record = serviceanfrageMap.get(id);
                if (record) crud.serviceanfrage.openDetail(record);
              }}
              onCardMove={async (cardId, newColumn) => {
                const id = cardId.split(':')[1];
                const anfrage = serviceanfrageMap.get(id);
                if (!anfrage) return;

                if (newColumn === 'erledigt') {
                  // Auftrag anlegen (falls noch nicht vorhanden) und erledigen
                  let auftrag = auftragByAnfrageId.get(id);
                  if (!auftrag) {
                    try {
                      const res = await LivingAppsService.createAuftragsverwaltungEntry({
                        anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, id),
                        erledigt: true,
                        erledigungsdatum: format(clock, 'yyyy-MM-dd'),
                      });
                      undoToast(
                        tx`Anfrage als erledigt markiert`,
                        async () => {
                          await LivingAppsService.deleteAuftragsverwaltungEntry(res.record_id);
                          await fetchAll();
                        }
                      );
                      await fetchAll();
                    } catch {
                      await fetchAll();
                    }
                  } else {
                    await handleErledigt(auftrag);
                  }
                } else {
                  // Dringlichkeit ändern
                  const prevDring = anfrage.fields.dringlichkeit;
                  const optimistic = serviceanfrage.map(r =>
                    r.record_id === id
                      ? { ...r, fields: { ...r.fields, dringlichkeit: lookupOption('serviceanfrage', 'dringlichkeit', newColumn) } }
                      : r
                  );
                  setServiceanfrage(optimistic);
                  try {
                    await LivingAppsService.updateServiceanfrageEntry(id, { dringlichkeit: newColumn });
                    undoToast(
                      tx`Dringlichkeit geändert`,
                      async () => {
                        setServiceanfrage(serviceanfrage);
                        await LivingAppsService.updateServiceanfrageEntry(id, {
                          dringlichkeit: lookupKey(prevDring) ?? newColumn,
                        });
                      }
                    );
                  } catch {
                    setServiceanfrage(serviceanfrage);
                    await fetchAll();
                  }
                }
              }}
              onAddCard={column => {
                if (column === 'erledigt') {
                  crud.serviceanfrage.openCreate({});
                } else {
                  crud.serviceanfrage.openCreate({ dringlichkeit: column });
                }
              }}
            />
          }
          aside={
            <>
              <WorkList
                title={tx('Offene Anfragen')}
                items={offeneAnfragen
                  .sort((a, b) => {
                    const order = ['notfall', 'dringend', 'normal', 'nicht_dringend'];
                    return order.indexOf(lookupKey(a.fields.dringlichkeit) ?? '') - order.indexOf(lookupKey(b.fields.dringlichkeit) ?? '');
                  })
                  .slice(0, 8)
                  .map(r => {
                    const auftrag = auftragByAnfrageId.get(r.record_id);
                    const dring = lookupKey(r.fields.dringlichkeit);
                    const name = [r.fields.vorname, r.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
                    return {
                      id: r.record_id,
                      title: name,
                      secondLine: (
                        <span className="flex gap-1 flex-wrap">
                          <span className={
                            dring === 'notfall' ? 'font-medium text-destructive'
                            : dring === 'dringend' ? 'font-medium text-amber-600'
                            : 'text-muted-foreground'
                          }>
                            {r.fields.dringlichkeit?.label ?? tx('Keine Angabe')}
                          </span>
                          {r.fields.strasse && (
                            <span className="text-muted-foreground truncate">· {r.fields.strasse} {r.fields.hausnummer}, {r.fields.ort}</span>
                          )}
                        </span>
                      ),
                      action: auftrag
                        ? { label: tx('✓ Erledigt'), onClick: () => handleErledigt(auftrag) }
                        : { label: tx('Auftrag anlegen'), onClick: () => handleAuftragAnlegen(r) },
                    };
                  })}
                onItemClick={id => {
                  const record = serviceanfrageMap.get(id);
                  if (record) crud.serviceanfrage.openDetail(record);
                }}
                empty={{
                  text: tx('Alle Anfragen erledigt — großartig!'),
                  action: { label: tx('Neue Anfrage aufnehmen'), onClick: () => crud.serviceanfrage.openCreate({}) },
                }}
              />
              <ChartWidget
                title={tx('Anfragen nach Dringlichkeit')}
                rows={serviceanfrage.map(r => ({
                  id: `sa:${r.record_id}`,
                  data: r,
                }))}
                dimension={{
                  kind: 'category',
                  accessor: r => r.data.fields.dringlichkeit,
                  label: tx('Dringlichkeit'),
                }}
              />
            </>
          }
        />
      )}

      {crud.surfaces}
    </div>
  );
}
