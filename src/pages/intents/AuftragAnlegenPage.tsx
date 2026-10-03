/**
 * Auftrag anlegen — 3-Schritt-Wizard.
 * Steps: 1) Serviceanfrage wählen → 2) Interne Notizen (optional) → 3) Prüfen & anlegen.
 * Reads: serviceanfrage. Writes: auftragsverwaltung (über useAuftragAnlegenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldLookup } from '@/lib/journey';
import { useAuftragAnlegenFlow } from '@/lib/journey/flows/AuftragAnlegen';
import { tx } from '@/i18n';

export default function AuftragAnlegenPage() {
  const [step, setStep] = useState(1);
  const flow = useAuftragAnlegenFlow({
    steps: { anfrage: 1, notizen: 2 },
    items: {
      anfrage: r => {
        const name = `${fieldText(r, 'vorname')} ${fieldText(r, 'nachname')}`.trim();
        const adresse = `${fieldText(r, 'strasse')} ${fieldText(r, 'hausnummer')}, ${fieldText(r, 'plz')} ${fieldText(r, 'ort')}`;
        const problem = fieldText(r, 'problembeschreibung');
        const dringlichkeit = fieldLookup(r, 'dringlichkeit');
        return {
          id: r.id,
          title: name || tx('Ohne Namen'),
          subtitle: `${adresse} — ${problem.length > 80 ? `${problem.slice(0, 80)}…` : problem}`,
          status: dringlichkeit ?? undefined,
          stats: [{ label: tx('Telefon'), value: fieldText(r, 'telefon') || '—' }],
        };
      },
    },
  });
  const form = flow.forms.auftragsverwaltung;

  return (
    <IntentWizardShell
      title={tx('Auftrag anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Zu einer eingegangenen Serviceanfrage einen offenen Auftrag anlegen.'),
        needs: [tx('Die passende Serviceanfrage'), tx('Optional: interne Notizen')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Wähle die Serviceanfrage, zu der du einen Auftrag anlegen willst.')}>
        <EntitySelectStep
          {...flow.picks.anfrage.select}
          {...flow.pick('anfrage')}
          avatar="initials"
          searchPlaceholder={tx('Name, Ort oder Problem …')}
          emptyText={tx('Es gibt keine Serviceanfrage, zu der noch ein Auftrag fehlt.')}
        />
      </WizardStep>
      <WizardStep label={tx('Notizen')} description={tx('Halte interne Hinweise zum Auftrag fest — das ist freiwillig.')} needs={['anfrage']}>
        <div className="space-y-4">
          <Bound form={form} name="notizen" rows={5} />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'erledigt', label: tx('Status'), value: tx('Offen') }]}
            whatHappensNext={tx('Der Auftrag wird als offen angelegt und ist der Anfrage zugeordnet.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Wenn die Arbeit erledigt ist, hakst du den Auftrag ab.')}
          next={[
            { label: tx('Auftrag abhaken'), href: '#/intents/auftrag-erledigen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
