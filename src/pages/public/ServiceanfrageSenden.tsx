import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { useStepForm, useJourneySubmit } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'serviceanfrage-senden';

export default function ServiceanfrageSenden() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
    });
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }
  return (
    <PublicShell title={page.title} description={page.description}>
      <RequestForm cfg={cfg} page={page} />
    </PublicShell>
  );
}

function RequestForm({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const [step, setStep] = useState(1);
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);

  const anfrage = useStepForm('serviceanfrage', {
    fields: [
      'problembeschreibung', 'strasse', 'hausnummer', 'plz', 'ort',
      'vorname', 'nachname', 'telefon', 'email', 'erreichbarkeit',
    ],
    steps: {
      problembeschreibung: 1,
      strasse: 2, hausnummer: 2, plz: 2, ort: 2,
      vorname: 3, nachname: 3, telefon: 3, email: 3, erreichbarkeit: 3,
    },
    autoComplete: true,
  });
  const submit = useJourneySubmit(
    port,
    [{ key: 'anfrage', entity: 'serviceanfrage', form: anfrage, primary: true }],
    { draftKey: 'serviceanfrage-senden' },
  );

  const steps = [
    { label: tx('Problem') },
    { label: tx('Einsatzort') },
    { label: tx('Kontakt') },
    { label: tx('Prüfen') },
  ];

  return (
    <IntentWizardShell
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[anfrage]}
      draftKey="serviceanfrage-senden"
    >
      {step === 1 && (
        <>
          <Bound form={anfrage} name="problembeschreibung" rows={5} />
          <StepNav
            hideBack
            onNext={() => anfrage.validate(['problembeschreibung'])}
            nextStepLabel={tx('Einsatzort')}
          />
        </>
      )}
      {step === 2 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2"><Bound form={anfrage} name="strasse" /></div>
            <Bound form={anfrage} name="hausnummer" />
            <Bound form={anfrage} name="plz" />
            <div className="sm:col-span-2"><Bound form={anfrage} name="ort" /></div>
          </div>
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => anfrage.validate(['strasse', 'hausnummer', 'plz', 'ort'])}
            nextStepLabel={tx('Kontakt')}
          />
        </>
      )}
      {step === 3 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Bound form={anfrage} name="vorname" />
            <Bound form={anfrage} name="nachname" />
            <Bound form={anfrage} name="telefon" />
            <Bound form={anfrage} name="email" />
          </div>
          <Bound form={anfrage} name="erreichbarkeit" className="mt-4" />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => anfrage.validate(['vorname', 'nachname', 'telefon', 'email', 'erreichbarkeit'])}
            nextStepLabel={tx('Prüfen')}
          />
        </>
      )}
      {step === 4 && !submit.done && (
        <SummaryStep
          forms={[anfrage]}
          submit={submit}
          whatHappensNext={tx('Wir melden uns so schnell wie möglich bei dir.')}
        />
      )}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[anfrage]}
          submit={submit}
          whatHappensNext={tx('Deine Serviceanfrage ist angekommen. Wir melden uns bei dir.')}
        />
      )}
    </IntentWizardShell>
  );
}
