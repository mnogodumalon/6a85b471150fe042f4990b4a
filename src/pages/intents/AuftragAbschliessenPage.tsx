/**
 * Auftrag abschließen — 3-Schritt-Wizard.
 * Steps: 1) Auftrag wählen → 2) Abschluss (Datum + Notizen) → 3) Prüfen & abschließen.
 * Reads: auftragsverwaltung (nur offene), serviceanfrage (Kontext). Writes: auftragsverwaltung (update: erledigt, erledigungsdatum, notizen).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useEffect, useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  fieldText,
  fieldRef,
  todayIso,
  type JourneyRecord,
} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { tx } from '@/i18n';

export default function AuftragAbschliessenPage() {
  const [step, setStep] = useState(1);
  const [auftragId, setAuftragId] = useState<string | null>(null);
  const [anfrage, setAnfrage] = useState<JourneyRecord | null>(null);

  const auftraege = useRecordSearch(servicePort, 'auftragsverwaltung', {
    searchFields: ['notizen'],
    filter: 'r.v_erledigt != True',
    where: r => r.fields.erledigt !== true,
    toItem: (r, ctx) => ({
      id: r.id,
      title: ctx.ref('anfrage') ?? tx('Auftrag ohne Anfrage'),
      subtitle: fieldText(r, 'notizen') || undefined,
    }),
  });

  const abschluss = useStepForm('auftragsverwaltung', {
    fields: ['erledigungsdatum', 'notizen'],
    steps: { erledigungsdatum: 2, notizen: 2 },
    initial: { erledigungsdatum: todayIso() },
    required: { erledigungsdatum: true },
  });

  const submit = useJourneySubmit(
    servicePort,
    [
      {
        key: 'abschluss',
        entity: 'auftragsverwaltung',
        form: abschluss,
        updates: () => auftragId ?? undefined,
        values: { erledigt: true },
        primary: true,
      },
    ],
    { draftKey: 'auftrag-abschliessen' },
  );

  // Read-only context: the linked Serviceanfrage of the picked Auftrag
  const anfrageId = auftragId ? fieldRef(auftraege.recordOf(auftragId) ?? ({ fields: {} } as JourneyRecord), 'anfrage') : null;
  useEffect(() => {
    let alive = true;
    setAnfrage(null);
    if (!anfrageId) return;
    servicePort.get('serviceanfrage', anfrageId).then(r => { if (alive) setAnfrage(r); }).catch(() => undefined);
    return () => { alive = false; };
  }, [anfrageId]);

  const pick = (id: string) => {
    setAuftragId(id);
    const rec = auftraege.recordOf(id);
    abschluss.set('notizen', rec ? fieldText(rec, 'notizen') : '');
    setStep(2);
  };

  const adresse = anfrage
    ? `${fieldText(anfrage, 'strasse')} ${fieldText(anfrage, 'hausnummer')}, ${fieldText(anfrage, 'plz')} ${fieldText(anfrage, 'ort')}`.trim()
    : '';
  const auftragLabel = auftragId ? auftraege.labelOf(auftragId) ?? '' : '';

  return (
    <IntentWizardShell
      title={tx('Auftrag abschließen')}
      currentStep={step}
      onStepChange={setStep}
      forms={[abschluss]}
      draftKey="auftrag-abschliessen"
      intro={{
        description: tx('Einen offenen Auftrag mit Datum und Notizen als erledigt markieren.'),
        needs: [tx('Den offenen Auftrag'), tx('Erledigungsdatum')],
      }}
    >
      <WizardStep label={tx('Auftrag')} description={tx('Welcher offene Auftrag ist erledigt?')}>
        <EntitySelectStep
          {...auftraege.select}
          selectedId={auftragId}
          onSelect={pick}
          create={false}
          searchPlaceholder={tx('In den Notizen suchen …')}
          emptyText={tx('Es gibt keine offenen Aufträge — alle sind bereits erledigt.')}
        />
      </WizardStep>

      <WizardStep label={tx('Abschluss')} description={tx('Wann wurde der Auftrag erledigt, und was solltest du festhalten?')}>
        {auftragId ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-secondary/50 p-4 space-y-1 overflow-hidden">
              <p className="text-sm font-semibold truncate">{auftragLabel}</p>
              {anfrage ? (
                <>
                  <p className="text-sm text-muted-foreground line-clamp-3">{fieldText(anfrage, 'problembeschreibung')}</p>
                  <p className="text-sm text-muted-foreground">{adresse}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{tx('Anfrage wird geladen …')}</p>
              )}
            </div>
            <Bound form={abschluss} name="erledigungsdatum" />
            <Bound form={abschluss} name="notizen" rows={4} />
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => abschluss.validate(['erledigungsdatum', 'notizen'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
          </StepNav>
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!submit.done && (
          <SummaryStep
            forms={[abschluss]}
            submit={submit}
            items={[
              { key: 'auftrag', label: tx('Auftrag'), value: auftragLabel || '—' },
              { key: 'erledigt', label: tx('Status'), value: tx('Erledigt') },
            ]}
            confirmLabel={tx('Auftrag abschließen')}
            whatHappensNext={tx('Der Auftrag wird als erledigt markiert und taucht nicht mehr bei den offenen Aufträgen auf.')}
          />
        )}
      </WizardStep>

      {submit.result && (
        <SuccessStep
          result={submit.result}
          submit={submit}
          forms={[abschluss]}
          actions={{ copy: false, print: false }}
          next={[
            { label: tx('Auftrag anlegen'), href: '#/intents/auftrag-anlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
