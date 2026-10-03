import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { IconAlertTriangle, IconPlus } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import type { Serviceanfrage, Auftragsverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { lookupKey } from '@/lib/formatters';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { MapWidget, type MapMarker, type MapTone } from '@/components/widgets/MapWidget';

type Filter = 'all' | 'offen' | 'inarbeit' | 'erledigt';

const URGENCY_RANK: Record<string, number> = { notfall: 0, dringend: 1, normal: 2, nicht_dringend: 3 };

function anfrageName(a: Serviceanfrage): string {
  const n = `${a.fields.vorname ?? ''} ${a.fields.nachname ?? ''}`.trim();
  return n || a.fields.ort || a.fields.strasse || '—';
}

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    serviceanfrage, auftragsverwaltung,
    setAuftragsverwaltung,
    fetchAll,
  } = data;
  const clock = useClock();
  const [filter, setFilter] = useState<Filter>('all');

  // --- derived state -------------------------------------------------------
  const auftragByAnfrage = useMemo(() => {
    const m = new Map<string, Auftragsverwaltung>();
    auftragsverwaltung.forEach(a => {
      const id = extractRecordId(a.fields.anfrage);
      if (id) m.set(id, a);
    });
    return m;
  }, [auftragsverwaltung]);

  const offen = useMemo(
    () => serviceanfrage
      .filter(a => !auftragByAnfrage.has(a.record_id))
      .sort((a, b) =>
        (URGENCY_RANK[lookupKey(a.fields.dringlichkeit) ?? 'normal'] ?? 2) - (URGENCY_RANK[lookupKey(b.fields.dringlichkeit) ?? 'normal'] ?? 2)
        || a.createdat.localeCompare(b.createdat)),
    [serviceanfrage, auftragByAnfrage],
  );
  const notfaelle = offen.filter(a => lookupKey(a.fields.dringlichkeit) === 'notfall');
  const offeneAuftraege = auftragsverwaltung.filter(a => !a.fields.erledigt);
  const erledigteAuftraege = auftragsverwaltung.filter(a => a.fields.erledigt);

  // --- writes (ONE path each, shared by hero, lists and overlay footer) ----
  const createAuftrag = async (a: Serviceanfrage) => {
    try {
      const res = await LivingAppsService.createAuftragsverwaltungEntry({
        anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, a.record_id),
        erledigt: false,
      });
      await fetchAll();
      undoToast(tx`Auftrag für ${anfrageName(a)} angelegt`, async () => {
        await LivingAppsService.deleteAuftragsverwaltungEntry(res.record_id);
        await fetchAll();
      });
    } catch {
      fetchAll();
    }
  };

  const markErledigt = (a: Auftragsverwaltung) => {
    const before = a.fields;
    const today = format(clock, 'yyyy-MM-dd');
    setAuftragsverwaltung(prev => prev.map(r => r.record_id === a.record_id
      ? { ...r, fields: { ...r.fields, erledigt: true, erledigungsdatum: today } } : r));
    LivingAppsService.updateAuftragsverwaltungEntry(a.record_id, { erledigt: true, erledigungsdatum: today })
      .catch(() => fetchAll());
    const sa = a.fields.anfrage ? data.serviceanfrageMap.get(extractRecordId(a.fields.anfrage) ?? '') : undefined;
    undoToast(tx`${sa ? anfrageName(sa) : appLabel('auftragsverwaltung')} erledigt`, () => {
      setAuftragsverwaltung(prev => prev.map(r => r.record_id === a.record_id ? { ...r, fields: before } : r));
      LivingAppsService.updateAuftragsverwaltungEntry(a.record_id, {
        erledigt: before.erledigt ?? false,
        erledigungsdatum: before.erledigungsdatum,
      }).catch(() => fetchAll());
    });
  };

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'serviceanfrage') {
        const a = top.record;
        return auftragByAnfrage.has(a.record_id)
          ? undefined
          : { label: tx('Auftrag anlegen'), onClick: () => createAuftrag(a) };
      }
      if (top.type === 'auftragsverwaltung') {
        const a = top.record;
        return a.fields.erledigt ? undefined : { label: tx('Als erledigt markieren'), onClick: () => markErledigt(a) };
      }
      return undefined;
    },
  });

  // --- map -----------------------------------------------------------------
  const visibleAnfragen = serviceanfrage.filter(a => {
    const au = auftragByAnfrage.get(a.record_id);
    if (filter === 'offen') return !au;
    if (filter === 'inarbeit') return !!au && !au.fields.erledigt;
    if (filter === 'erledigt') return !!au?.fields.erledigt;
    return true;
  });

  const markers: MapMarker[] = visibleAnfragen.flatMap(a => {
    const geo = a.fields.einsatzort_geo;
    if (!geo) return [];
    const au = auftragByAnfrage.get(a.record_id);
    const key = lookupKey(a.fields.dringlichkeit);
    let tone: MapTone = 'default';
    if (au) tone = au.fields.erledigt ? 'success' : 'primary';
    else if (key === 'notfall') tone = 'destructive';
    else if (key === 'dringend') tone = 'warning';
    return [{
      id: `anfrage:${a.record_id}`,
      lat: geo.lat,
      long: geo.long,
      title: anfrageName(a),
      subtitle: [a.fields.strasse, a.fields.hausnummer, a.fields.ort].filter(Boolean).join(' ') || geo.info,
      tone,
      icon: 'tool' as const,
    }];
  });

  // --- header context line ---------------------------------------------------
  let context: string;
  if (notfaelle.length > 0) {
    context = tx`${namen(notfaelle.map(a => anfrageName(a)))} brauchen sofort einen Einsatz.`;
  } else if (offen.length > 0) {
    context = tx`Neu eingegangen: ${namen(offen.map(a => anfrageName(a)))} — noch ohne Auftrag.`;
  } else if (offeneAuftraege.length > 0) {
    const names = offeneAuftraege
      .map(a => data.serviceanfrageMap.get(extractRecordId(a.fields.anfrage) ?? ''))
      .filter((s): s is Serviceanfrage => !!s)
      .map(anfrageName);
    context = tx`Offen in Arbeit: ${namen(names)}.`;
  } else {
    context = tx`Alles erledigt — keine offenen Anfragen oder Aufträge.`;
  }

  const toggle = (f: Filter) => setFilter(cur => (cur === f ? 'all' : f));

  const rawAuftrag = (id: string) => auftragsverwaltung.find(a => a.record_id === id);
  const rawAnfrage = (id: string) => serviceanfrage.find(a => a.record_id === id);

  const urgencyWord = (a: Serviceanfrage) => {
    const key = lookupKey(a.fields.dringlichkeit);
    const cls = key === 'notfall' ? 'text-destructive' : key === 'dringend' ? 'text-amber-600' : 'text-muted-foreground';
    return <span className={`font-medium ${cls}`}>{a.fields.dringlichkeit?.label?.split(' – ')[0] ?? '—'}</span>;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-1">{context}</p>
        </div>
        <Button onClick={() => crud.serviceanfrage.openCreate({ dringlichkeit: 'normal' })} className="shrink-0">
          <IconPlus size={16} className="shrink-0" />
          <span>{tx('Neue Anfrage')}</span>
        </Button>
      </div>

      <DashboardGrid
        variant="split"
        hero={notfaelle.length > 0 && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{ label: tx('Auftrag anlegen'), onClick: () => createAuftrag(notfaelle[0]) }}
          >
            <b>{namen(notfaelle.map(a => anfrageName(a)))}</b>{' '}
            {notfaelle.length === 1
              ? tx`meldet einen Notfall — seit ${formatDate(notfaelle[0].createdat)} ohne Auftrag.`
              : tx`melden Notfälle — noch ohne Auftrag.`}
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Ohne Auftrag')}
              value={offen.length}
              onClick={() => toggle('offen')}
              active={filter === 'offen'}
            />
            <StatStripItem
              title={tx('In Arbeit')}
              value={offeneAuftraege.length}
              tone={offeneAuftraege.length > 0 ? 'primary' : 'default'}
              onClick={() => toggle('inarbeit')}
              active={filter === 'inarbeit'}
            />
            <StatStripItem
              title={tx('Erledigt')}
              value={`${erledigteAuftraege.length}/${auftragsverwaltung.length}`}
              tone={erledigteAuftraege.length > 0 ? 'success' : 'default'}
              onClick={() => toggle('erledigt')}
              active={filter === 'erledigt'}
            />
          </StatStrip>
        }
        aside={
          <>
            <WorkList
              title={tx('Anfragen ohne Auftrag')}
              items={offen.map(a => ({
                id: a.record_id,
                title: anfrageName(a),
                secondLine: (
                  <>
                    {urgencyWord(a)}
                    <span className="text-muted-foreground"> · {a.fields.ort ?? formatDate(a.createdat)}</span>
                  </>
                ),
                action: { label: tx('Auftrag'), onClick: () => createAuftrag(a) },
              }))}
              onItemClick={id => { const r = rawAnfrage(id); if (r) crud.serviceanfrage.openDetail(r); }}
              empty={{
                text: tx('Alle Anfragen sind in Bearbeitung.'),
                action: { label: tx('Neue Anfrage'), onClick: () => crud.serviceanfrage.openCreate({ dringlichkeit: 'normal' }) },
              }}
            />
            <WorkList
              title={tx('Offene Aufträge')}
              items={offeneAuftraege.map(a => {
                const sa = data.serviceanfrageMap.get(extractRecordId(a.fields.anfrage) ?? '');
                return {
                  id: a.record_id,
                  title: sa ? anfrageName(sa) : appLabel('auftragsverwaltung'),
                  secondLine: (
                    <>
                      {sa && urgencyWord(sa)}
                      <span className="text-muted-foreground"> · {sa?.fields.ort ?? formatDate(a.createdat)}</span>
                    </>
                  ),
                  action: { label: tx('✓ Erledigt'), onClick: () => markErledigt(a) },
                };
              })}
              onItemClick={id => { const r = rawAuftrag(id); if (r) crud.auftragsverwaltung.openDetail(r); }}
              empty={{
                text: tx('Keine offenen Aufträge.'),
                action: offen[0]
                  ? { label: tx`Auftrag für ${anfrageName(offen[0])}`, onClick: () => createAuftrag(offen[0]) }
                  : undefined,
              }}
            />
          </>
        }
        primary={
          <MapWidget
            markers={markers}
            legend={[
              { label: tx('Notfall'), tone: 'destructive' },
              { label: tx('Dringend'), tone: 'warning' },
              { label: tx('In Arbeit'), tone: 'primary' },
              { label: tx('Erledigt'), tone: 'success' },
            ]}
            onMarkerClick={m => {
              const r = rawAnfrage(m.id.split(':')[1]);
              if (r) crud.serviceanfrage.openDetail(r);
            }}
          />
        }
      />
      {crud.surfaces}
    </div>
  );
}
