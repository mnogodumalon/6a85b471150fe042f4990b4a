/**
 * Auftrag anlegen — 3-Schritt-Wizard.
 * Steps: 1) Anfrage wählen (nur Anfragen ohne Auftrag, Notfälle zuerst) → 2) Interne Notizen → 3) Prüfen & anlegen.
 * Reads: serviceanfrage (useRecordSearch), auftragsverwaltung (nur anfrage-Verweise, für die Eignung).
 * Writes: auftragsverwaltung (create, erledigt bleibt leer).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep, StatusBadge.
 */
import { useEffect, useMemo, useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useStepForm, useJourneySubmit, useRecordSearch, fieldText, fieldLookup, fieldRef } from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

const RANK: Record<string, number> = { notfall: 0, dringend: 1, normal: 2, nicht_dringend: 3 };

export default function AuftragAnlegenPage() {
  const [step, setStep] = useState(1);
  // Anfragen, die schon einen Auftrag haben — null bis bekannt
  const [taken, setTaken] = useState<Set<string> | null>(null);
  const [takenError, setTakenError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    servicePort
      .list('auftragsverwaltung', { fields: ['anfrage'], limit: 5000 })
      .then(list => {
        if (!alive) return;
        const ids = new Set<string>();
        list.forEach(r => {
          const id = fieldRef(r, 'anfrage');
          if (id) ids.add(id);
        });
        setTaken(ids);
      })
      .catch(e => alive && setTakenError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; };
  }, []);

  const anfragen = useRecordSearch(servicePort, 'serviceanfrage', {
    searchFields: ['nachname', 'vorname', 'strasse', 'ort', 'problembeschreibung'],
    where: r => !(taken?.has(r.id) ?? false),
    toItem: r => ({
      id: r.id,
      title: `${fieldText(r, 'vorname')} ${fieldText(r, 'nachname')}`.trim(),
      subtitle: `${fieldText(r, 'strasse')} ${fieldText(r, 'hausnummer')}, ${fieldText(r, 'plz')} ${fieldText(r, 'ort')}`,
      status: fieldLookup(r, 'dringlichkeit') ?? undefined,
    }),
  });

  const sortedItems = useMemo(() => {
    const rank = (id: string) => {
      const rec = anfragen.recordOf(id);
      const key = rec ? fieldLookup(rec, 'dringlichkeit')?.key : undefined;
      return key !== undefined ? (RANK[key] ?? 9) : 9;
    };
    return [...anfragen.select.items].sort((a, b) => rank(a.id) - rank(b.id));
  }, [anfragen]);

  const f = useStepForm('auftragsverwaltung', {
    fields: ['anfrage', 'notizen'],
    steps: { anfrage: 1, notizen: 2 },
  });

  const submit = useJourneySubmit(servicePort, [
    { key: 'auftrag', entity: 'auftragsverwaltung', form: f, primary: true },
  ], { draftKey: 'auftrag-anlegen' });

  const anfrageId = f.get('anfrage') as string | undefined;
  const anfrage = anfrageId ? anfragen.recordOf(anfrageId) : undefined;
  const dringlichkeit = anfrage ? fieldLookup(anfrage, 'dringlichkeit') : null;

  return (
    <IntentWizardShell
      title={tx('Auftrag anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[f]}
      draftKey="auftrag-anlegen"
      intro={{
        description: tx('Aus einer Serviceanfrage einen Auftrag machen.'),
        needs: [tx('Eine Serviceanfrage ohne Auftrag')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Für welche Anfrage soll ein Auftrag entstehen? Notfälle stehen oben.')}>
        {takenError ? (
          <p className="text-sm text-destructive">{takenError}</p>
        ) : taken === null ? (
          <p className="text-sm text-muted-foreground">{tx('Anfragen werden geladen …')}</p>
        ) : (
          <EntitySelectStep
            {...anfragen.select}
            items={sortedItems}
            selectedId={anfrageId ?? null}
            onSelect={id => f.set('anfrage', id, anfragen.labelOf(id))}
            create={false}
            avatar="initials"
            searchPlaceholder={tx('Name, Adresse oder Problem …')}
            emptyText={tx('Alle Anfragen haben schon einen Auftrag.')}
          />
        )}
      </WizardStep>

      <WizardStep label={tx('Notizen')} description={tx('Interne Hinweise zum Auftrag festhalten.')} needs={['anfrage']}>
        <div className="space-y-4">
          <div className="rounded-xl border bg-secondary/40 p-4 text-sm space-y-1 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{anfrageId ? anfragen.labelOf(anfrageId) : ''}</span>
              {dringlichkeit && <StatusBadge statusKey={dringlichkeit.key} label={dringlichkeit.label} />}
            </div>
            {anfrage && (
              <>
                <p className="text-muted-foreground">
                  {fieldText(anfrage, 'strasse')} {fieldText(anfrage, 'hausnummer')}, {fieldText(anfrage, 'plz')} {fieldText(anfrage, 'ort')}
                </p>
                <p className="text-muted-foreground">{fieldText(anfrage, 'telefon')}</p>
                <p className="whitespace-pre-wrap break-words">{fieldText(anfrage, 'problembeschreibung')}</p>
              </>
            )}
          </div>
          <Bound form={f} name="notizen" rows={4} />
          <StepNav onBack={() => setStep(1)} onNext={() => f.validate(['notizen'])} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Der Auftrag wird offen angelegt und kann später abgeschlossen werden.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          submit={submit}
          next={[
            { label: tx('Auftrag abschließen'), href: '#/intents/auftrag-abschliessen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Wenn die Arbeit erledigt ist, schließt du den Auftrag im Ablauf „Auftrag abschließen“ ab.')}
        />
      )}
    </IntentWizardShell>
  );
}
