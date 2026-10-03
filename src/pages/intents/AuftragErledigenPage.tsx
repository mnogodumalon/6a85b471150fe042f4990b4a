/**
 * Auftrag abhaken — 3-Schritt-Wizard.
 * Steps: 1) Offenen Auftrag wählen → 2) Notizen ergänzen (optional) → 3) Als erledigt abhaken (Prüfen).
 * Reads: auftragsverwaltung (Auswahl), serviceanfrage (Name der Anfrage auf der Karte).
 * Writes: auftragsverwaltung (update: erledigt = true, erledigungsdatum = heute, notizen) via useAuftragErledigenFlow.
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText } from '@/lib/journey';
import { useAuftragErledigenFlow } from '@/lib/journey/flows/AuftragErledigen';
import { tx } from '@/i18n';

export default function AuftragErledigenPage() {
  const [step, setStep] = useState(1);
  const flow = useAuftragErledigenFlow({
    steps: { auftragsverwaltung: 1, notizen: 2 },
    items: {
      auftragsverwaltung: (r, ctx) => ({
        id: r.id,
        title: ctx.ref('anfrage') ?? tx('Auftrag ohne Anfrage'),
        subtitle: fieldText(r, 'notizen') || undefined,
      }),
    },
  });

  return (
    <IntentWizardShell
      title={tx('Auftrag abhaken')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Einen offenen Auftrag als erledigt markieren.'),
        needs: [tx('Den Auftrag, den du erledigt hast')],
      }}
    >
      <WizardStep label={tx('Auftrag')} description={tx('Welchen offenen Auftrag hast du erledigt?')}>
        <EntitySelectStep
          {...flow.picks.auftragsverwaltung.select}
          {...flow.pick('auftragsverwaltung')}
          searchPlaceholder={tx('Anfrage suchen …')}
          emptyText={tx('Es gibt keinen offenen Auftrag.')}
        />
      </WizardStep>
      <WizardStep
        label={tx('Notizen')}
        description={tx('Halte fest, was du gemacht hast — das ist freiwillig.')}
        needs={['auftragsverwaltung']}
      >
        <div className="space-y-4">
          <Bound form={flow.forms.auftragsverwaltung} name="notizen" rows={4} />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')} description={tx('Stimmt alles? Dann hakst du den Auftrag ab.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            confirmLabel={tx('Als erledigt abhaken')}
            whatHappensNext={tx('Der Auftrag wird als erledigt markiert und mit dem heutigen Datum versehen.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          title={tx('Auftrag erledigt')}
          actions={{ copy: false, print: false }}
          next={[
            { label: tx('Noch einen Auftrag abhaken'), onClick: () => flow.reset() },
            { label: tx('Auftrag zur Anfrage anlegen'), href: '#/intents/auftrag-anlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
