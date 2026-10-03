import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { IconAlertTriangle, IconPlus } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import type { Serviceanfrage, Auftragsverwaltung } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, appLabel } from '@/i18n';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { Button } from '@/components/ui/button';
import { KanbanWidget, type KanbanCard, type KanbanColumn } from '@/components/widgets/KanbanWidget';

type Filter = 'all' | 'ohne' | 'offen';
type Stage = 'ohne' | 'offen' | 'erledigt';

function personName(a: Serviceanfrage): string {
  return `${a.fields.vorname ?? ''} ${a.fields.nachname ?? ''}`.trim();
}

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    serviceanfrage, auftragsverwaltung,
    setServiceanfrage, setAuftragsverwaltung,
    fetchAll,
  } = data;
  const clock = useClock();
  const [filter, setFilter] = useState<Filter>('all');

  // ── Shared write helpers (hero, work lists, overlay footer, board) ──
  const createAuftraege = async (anfragen: Serviceanfrage[]) => {
    if (anfragen.length === 0) return;
    try {
      const created: string[] = [];
      for (const a of anfragen) {
        const res = await LivingAppsService.createAuftragsverwaltungEntry({
          anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, a.record_id),
          erledigt: false,
        });
        created.push(res.record_id);
      }
      await fetchAll();
      const label = anfragen.length === 1 ? personName(anfragen[0]) || tx('Anfrage') : '';
      const msg = anfragen.length === 1 ? tx`Auftrag für ${label} angelegt` : tx`${anfragen.length} Aufträge angelegt`;
      undoToast(msg, async () => {
        await Promise.all(created.map(id => LivingAppsService.deleteAuftragsverwaltungEntry(id)));
        await fetchAll();
      });
    } catch {
      await fetchAll();
    }
  };

  const markDone = (auftrag: Auftragsverwaltung) => {
    const before = auftrag.fields;
    const day = format(clock, 'yyyy-MM-dd');
    setAuftragsverwaltung(prev => prev.map(r => r.record_id === auftrag.record_id
      ? { ...r, fields: { ...r.fields, erledigt: true, erledigungsdatum: day } } : r));
    LivingAppsService.updateAuftragsverwaltungEntry(auftrag.record_id, { erledigt: true, erledigungsdatum: day })
      .catch(() => fetchAll());
    undoToast(tx`Auftrag abgehakt`, () => {
      setAuftragsverwaltung(prev => prev.map(r => r.record_id === auftrag.record_id
        ? { ...r, fields: { ...r.fields, erledigt: before.erledigt ?? false, erledigungsdatum: before.erledigungsdatum } } : r));
      LivingAppsService.updateAuftragsverwaltungEntry(auftrag.record_id, {
        erledigt: before.erledigt ?? false,
        erledigungsdatum: before.erledigungsdatum,
      }).catch(() => fetchAll());
    });
  };

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'serviceanfrage') {
        const a = serviceanfrage.find(r => r.record_id === top.record.record_id);
        const has = auftragsverwaltung.some(o => extractRecordId(o.fields.anfrage) === top.record.record_id);
        return a && !has ? { label: tx('Auftrag anlegen'), onClick: () => { void createAuftraege([a]); } } : undefined;
      }
      if (top.type === 'auftragsverwaltung') {
        const o = auftragsverwaltung.find(r => r.record_id === top.record.record_id);
        return o && !o.fields.erledigt ? { label: tx('Als erledigt abhaken'), onClick: () => markDone(o) } : undefined;
      }
      return undefined;
    },
  });

  // ── Derivations ──
  const { stageOf, ohneAuftrag, offeneAuftraege, erledigtCount, openAnfragen } = useMemo(() => {
    const byAnfrage = new Map<string, Auftragsverwaltung[]>();
    for (const o of auftragsverwaltung) {
      const id = extractRecordId(o.fields.anfrage);
      if (!id) continue;
      byAnfrage.set(id, [...(byAnfrage.get(id) ?? []), o]);
    }
    const stageOf = (a: Serviceanfrage): Stage => {
      const list = byAnfrage.get(a.record_id) ?? [];
      if (list.length === 0) return 'ohne';
      return list.every(o => o.fields.erledigt) ? 'erledigt' : 'offen';
    };
    const byAge = (x: Serviceanfrage, y: Serviceanfrage) => (x.createdat ?? '').localeCompare(y.createdat ?? '');
    return {
      stageOf,
      ohneAuftrag: serviceanfrage.filter(a => stageOf(a) === 'ohne').sort(byAge),
      offeneAuftraege: auftragsverwaltung.filter(o => !o.fields.erledigt),
      erledigtCount: auftragsverwaltung.filter(o => o.fields.erledigt).length,
      openAnfragen: serviceanfrage.filter(a => stageOf(a) !== 'erledigt').sort(byAge),
    };
  }, [serviceanfrage, auftragsverwaltung]);

  const urgentOhne = ohneAuftrag.filter(a => {
    const k = lookupKey(a.fields.dringlichkeit);
    return k === 'notfall' || k === 'dringend';
  });

  const columns: KanbanColumn[] = [...(LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? [])]
    .reverse()
    .map(o => ({
      key: o.key,
      label: o.label,
      tone: o.key === 'notfall' ? 'destructive' : o.key === 'dringend' ? 'warning' : 'default',
    }));

  const cards: KanbanCard[] = openAnfragen
    .filter(a => filter === 'all' || stageOf(a) === filter)
    .map(a => {
      const stage = stageOf(a);
      const place = [a.fields.plz, a.fields.ort].filter(Boolean).join(' ');
      return {
        id: `anfrage:${a.record_id}`,
        column: lookupKey(a.fields.dringlichkeit) ?? 'normal',
        title: personName(a) || tx('Unbekannt'),
        subtitle: (
          <span className="block min-w-0">
            <span className="block truncate">{a.fields.problembeschreibung ?? ''}</span>
            <span className="block truncate text-muted-foreground">
              {place ? `${place} · ` : ''}{stage === 'ohne' ? tx('Noch kein Auftrag') : tx('Auftrag offen')}
            </span>
          </span>
        ),
      };
    });

  const moveCard = (cardId: string, newColumn: string) => {
    const id = cardId.split(':')[1];
    const rec = serviceanfrage.find(r => r.record_id === id);
    if (!rec) return;
    const prev = rec.fields.dringlichkeit;
    setServiceanfrage(list => list.map(r => r.record_id === id
      ? { ...r, fields: { ...r.fields, dringlichkeit: lookupOption('serviceanfrage', 'dringlichkeit', newColumn) } } : r));
    LivingAppsService.updateServiceanfrageEntry(id, { dringlichkeit: newColumn }).catch(() => fetchAll());
    const label = lookupOption('serviceanfrage', 'dringlichkeit', newColumn).label;
    undoToast(tx`Dringlichkeit geändert: ${label}`, prev ? () => {
      setServiceanfrage(list => list.map(r => r.record_id === id ? { ...r, fields: { ...r.fields, dringlichkeit: prev } } : r));
      LivingAppsService.updateServiceanfrageEntry(id, { dringlichkeit: prev.key }).catch(() => fetchAll());
    } : undefined);
  };

  const openAnfrage = (id: string) => {
    const rec = serviceanfrage.find(r => r.record_id === id);
    if (rec) crud.serviceanfrage.openDetail(rec);
  };

  // ── Context line ──
  const urgentNames = namen(urgentOhne.map(a => a.fields.nachname || a.fields.vorname || ''));
  const ohneNames = namen(ohneAuftrag.map(a => a.fields.nachname || a.fields.vorname || ''));
  const offenNames = namen(offeneAuftraege.map(o => crud.enriched.auftragsverwaltung.find(e => e.record_id === o.record_id)?.anfrageName ?? ''));
  const greeting = gruss(clock);
  let context: string;
  if (urgentOhne.length > 0) context = tx`Dringend: ${urgentNames} wartet auf eine Rückmeldung.`;
  else if (ohneAuftrag.length > 0) context = tx`Neue Anfragen von ${ohneNames} warten auf einen Auftrag.`;
  else if (offeneAuftraege.length > 0) context = tx`Offen sind noch die Aufträge von ${offenNames}.`;
  else context = tx`Alles abgehakt — keine offenen Anfragen.`;

  const stageWord = (s: Stage) => s === 'ohne'
    ? <span className="font-medium text-amber-600">{tx('Ohne Auftrag')}</span>
    : <span className="font-medium text-primary">{tx('Auftrag offen')}</span>;

  const toggle = (f: Filter) => setFilter(cur => (cur === f ? 'all' : f));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        <Button onClick={() => crud.serviceanfrage.openCreate({})} className="shrink-0">
          <IconPlus size={16} className="shrink-0" />
          <span>{tx('Neue Anfrage')}</span>
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={urgentOhne.length > 0 && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{ label: tx('Aufträge anlegen'), onClick: () => { void createAuftraege(urgentOhne); } }}
          >
            {urgentOhne.length === 1
              ? tx`${urgentNames} wartet dringend auf einen Auftrag.`
              : tx`${urgentNames} warten dringend auf einen Auftrag.`}
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Offene Aufträge')}
              value={offeneAuftraege.length}
              tone={offeneAuftraege.length > 0 ? 'primary' : 'default'}
              onClick={() => toggle('offen')}
              active={filter === 'offen'}
            />
            <StatStripItem
              title={tx('Anfragen ohne Auftrag')}
              value={ohneAuftrag.length}
              tone={ohneAuftrag.length > 0 ? 'warning' : 'default'}
              onClick={() => toggle('ohne')}
              active={filter === 'ohne'}
            />
            <StatStripItem title={tx('Erledigt')} value={erledigtCount} tone={erledigtCount > 0 ? 'success' : 'default'} />
          </StatStrip>
        }
        primary={
          <KanbanWidget
            cards={cards}
            columns={columns}
            onCardClick={card => openAnfrage(card.id.split(':')[1] ?? '')}
            onCardMove={moveCard}
            onAddCard={column => crud.serviceanfrage.openCreate({ dringlichkeit: column })}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Anfragen ohne Auftrag')}
              items={ohneAuftrag.map(a => ({
                id: a.record_id,
                title: personName(a) || tx('Unbekannt'),
                secondLine: <>{stageWord('ohne')}<span className="text-muted-foreground"> · {a.fields.problembeschreibung ?? ''}</span></>,
                action: { label: tx('Auftrag anlegen'), onClick: () => { void createAuftraege([a]); } },
              }))}
              onItemClick={openAnfrage}
              empty={{ text: tx('Jede Anfrage hat einen Auftrag.'), action: { label: tx('Neue Anfrage'), onClick: () => crud.serviceanfrage.openCreate({}) } }}
            />
            <WorkList
              title={tx('Offene Aufträge')}
              items={offeneAuftraege.map(o => {
                const enriched = crud.enriched.auftragsverwaltung.find(e => e.record_id === o.record_id);
                const anfrage = serviceanfrage.find(a => a.record_id === extractRecordId(o.fields.anfrage));
                return {
                  id: o.record_id,
                  title: enriched?.anfrageName || appLabel('auftragsverwaltung'),
                  secondLine: <>{stageWord('offen')}<span className="text-muted-foreground"> · {anfrage?.fields.problembeschreibung ?? o.fields.notizen ?? ''}</span></>,
                  action: { label: tx('✓ Erledigt'), onClick: () => markDone(o) },
                };
              })}
              onItemClick={id => {
                const rec = auftragsverwaltung.find(r => r.record_id === id);
                if (rec) crud.auftragsverwaltung.openDetail(rec);
              }}
              empty={{ text: tx('Keine offenen Aufträge.') }}
            />
          </>
        }
      />
      {crud.surfaces}
    </div>
  );
}
