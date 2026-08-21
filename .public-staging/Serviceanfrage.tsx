import { useEffect, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import {
  loadPublicPagesConfig,
  createPublicRecord,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconBolt,
  IconClock,
  IconAlertCircle,
  IconSend,
  IconChevronRight,
  IconChevronLeft,
} from '@tabler/icons-react';

const SLUG = 'anfrage';

type Dringlichkeit = 'nicht_dringend' | 'normal' | 'dringend' | 'notfall';

interface FormState {
  problembeschreibung: string;
  dringlichkeit: Dringlichkeit | '';
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  vorname: string;
  nachname: string;
  telefon: string;
  email: string;
  erreichbarkeit: string;
}

const INITIAL_FORM: FormState = {
  problembeschreibung: '',
  dringlichkeit: '',
  strasse: '',
  hausnummer: '',
  plz: '',
  ort: '',
  vorname: '',
  nachname: '',
  telefon: '',
  email: '',
  erreichbarkeit: '',
};

interface DringlichkeitOption {
  key: Dringlichkeit;
  label: () => string;
  description: () => string;
  icon: React.ReactNode;
  tone: string;
}

const DRINGLICHKEIT_OPTIONS: DringlichkeitOption[] = [
  {
    key: 'nicht_dringend',
    label: () => tx('Nicht dringend'),
    description: () => tx('Kann warten'),
    icon: <IconClock size={22} className="shrink-0" />,
    tone: 'text-slate-500 bg-slate-50 border-slate-200',
  },
  {
    key: 'normal',
    label: () => tx('Normal'),
    description: () => tx('Innerhalb der nächsten Tage'),
    icon: <IconAlertCircle size={22} className="shrink-0" />,
    tone: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  {
    key: 'dringend',
    label: () => tx('Dringend'),
    description: () => tx('So bald wie möglich'),
    icon: <IconAlertTriangle size={22} className="shrink-0" />,
    tone: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  {
    key: 'notfall',
    label: () => tx('Notfall'),
    description: () => tx('Sofortiger Einsatz nötig'),
    icon: <IconBolt size={22} className="shrink-0" />,
    tone: 'text-red-600 bg-red-50 border-red-200',
  },
];

function RequiredMark() {
  return <span className="text-destructive ml-0.5">*</span>;
}

function FieldError({ msg }: { msg: string }) {
  return <p className="text-sm text-destructive mt-1">{msg}</p>;
}

export default function Serviceanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setPageLoading(false);
        if (!c?.pages[SLUG]) setUnavailable(true);
      })
      .catch(err => {
        setPageLoading(false);
        if (err instanceof PageUnavailableError) {
          setUnavailable(true);
        } else {
          setUnavailable(true);
        }
      });
  }, []);

  if (pageLoading || unavailable || !cfg || !page) {
    return <PublicShell loading={pageLoading} unavailable={!pageLoading && unavailable} />;
  }

  const ep = page.endpoints?.find(e => e.op === 'create');

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateStep1(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.problembeschreibung.trim()) errs.problembeschreibung = tx('Bitte beschreibe das Problem.');
    if (!form.dringlichkeit) errs.dringlichkeit = tx('Bitte wähle eine Dringlichkeit.');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.strasse.trim()) errs.strasse = tx('Bitte gib die Straße an.');
    if (!form.hausnummer.trim()) errs.hausnummer = tx('Bitte gib die Hausnummer an.');
    if (!form.plz.trim()) errs.plz = tx('Bitte gib die Postleitzahl an.');
    if (!form.ort.trim()) errs.ort = tx('Bitte gib den Ort an.');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep3(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.vorname.trim()) errs.vorname = tx('Bitte gib deinen Vornamen an.');
    if (!form.nachname.trim()) errs.nachname = tx('Bitte gib deinen Nachnamen an.');
    if (!form.telefon.trim()) errs.telefon = tx('Bitte gib eine Telefonnummer an.');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goToStep2() {
    if (validateStep1()) setStep(2);
  }

  function goToStep3() {
    if (validateStep2()) setStep(3);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep3()) return;
    if (!cfg || !page || !ep) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, string> = {
        problembeschreibung: form.problembeschreibung.trim(),
        dringlichkeit: form.dringlichkeit,
        strasse: form.strasse.trim(),
        hausnummer: form.hausnummer.trim(),
        plz: form.plz.trim(),
        ort: form.ort.trim(),
        vorname: form.vorname.trim(),
        nachname: form.nachname.trim(),
        telefon: form.telefon.trim(),
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.erreichbarkeit.trim()) payload.erreichbarkeit = form.erreichbarkeit.trim();

      await createPublicRecord(cfg, page, payload);
      setSubmitted(true);
    } catch {
      setSubmitError(tx('Die Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  }

  const steps = [
    { label: tx('Problem') },
    { label: tx('Einsatzort') },
    { label: tx('Kontakt') },
  ];

  if (submitted) {
    return (
      <PublicShell title={tx('Serviceanfrage')} description={tx('Elektriker-Service – schnell und zuverlässig')}>
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCircleCheck size={36} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{tx('Anfrage erfolgreich gesendet!')}</h2>
            <p className="text-muted-foreground mt-2 max-w-sm">
              {tx('Wir haben deine Serviceanfrage erhalten und melden uns so bald wie möglich bei dir.')}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setForm(INITIAL_FORM);
              setStep(1);
              setSubmitted(false);
              setErrors({});
            }}
          >
            {tx('Neue Anfrage stellen')}
          </Button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={tx('Serviceanfrage')} description={tx('Elektriker-Service – schnell und zuverlässig')}>
      <IntentWizardShell
        steps={steps}
        currentStep={step}
        onStepChange={setStep}
        back={false}
      >
        {/* Step 1 — Problembeschreibung + Dringlichkeit */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="problembeschreibung">
                {tx('Problembeschreibung')}<RequiredMark />
              </Label>
              <Textarea
                id="problembeschreibung"
                rows={4}
                placeholder={tx('Beschreibe das elektrische Problem so genau wie möglich …')}
                value={form.problembeschreibung}
                onChange={e => set('problembeschreibung', e.target.value)}
                onFocus={() => {
                  if (cfg && page) prepareChallenge(cfg, page, 'POST', `/apps/${ep?.app_id}/records`);
                }}
                className={errors.problembeschreibung ? 'border-destructive' : ''}
              />
              {errors.problembeschreibung && <FieldError msg={errors.problembeschreibung} />}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">
                {tx('Dringlichkeit')}<RequiredMark />
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DRINGLICHKEIT_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => set('dringlichkeit', opt.key)}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      form.dringlichkeit === opt.key
                        ? `${opt.tone} border-current ring-2 ring-current/20 font-semibold`
                        : 'border-border bg-card hover:border-primary/30 hover:bg-muted/40'
                    }`}
                  >
                    <span className={form.dringlichkeit === opt.key ? '' : 'text-muted-foreground'}>
                      {opt.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{opt.label()}</span>
                      <span className="block text-xs text-muted-foreground">{opt.description()}</span>
                    </span>
                  </button>
                ))}
              </div>
              {errors.dringlichkeit && <FieldError msg={errors.dringlichkeit} />}
            </div>

            <div className="flex justify-end">
              <Button onClick={goToStep2} className="gap-2">
                {tx('Weiter')} <IconChevronRight size={16} className="shrink-0" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Einsatzort */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="strasse">
                  {tx('Straße')}<RequiredMark />
                </Label>
                <Input
                  id="strasse"
                  type="text"
                  placeholder={tx('Musterstraße')}
                  value={form.strasse}
                  onChange={e => set('strasse', e.target.value)}
                  className={errors.strasse ? 'border-destructive' : ''}
                />
                {errors.strasse && <FieldError msg={errors.strasse} />}
              </div>
              <div className="space-y-2">
                <Label htmlFor="hausnummer">
                  {tx('Nr.')}<RequiredMark />
                </Label>
                <Input
                  id="hausnummer"
                  type="text"
                  placeholder={tx('12a')}
                  value={form.hausnummer}
                  onChange={e => set('hausnummer', e.target.value)}
                  className={errors.hausnummer ? 'border-destructive' : ''}
                />
                {errors.hausnummer && <FieldError msg={errors.hausnummer} />}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plz">
                  {tx('PLZ')}<RequiredMark />
                </Label>
                <Input
                  id="plz"
                  type="text"
                  placeholder={tx('12345')}
                  value={form.plz}
                  onChange={e => set('plz', e.target.value)}
                  className={errors.plz ? 'border-destructive' : ''}
                />
                {errors.plz && <FieldError msg={errors.plz} />}
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="ort">
                  {tx('Ort')}<RequiredMark />
                </Label>
                <Input
                  id="ort"
                  type="text"
                  placeholder={tx('Berlin')}
                  value={form.ort}
                  onChange={e => set('ort', e.target.value)}
                  className={errors.ort ? 'border-destructive' : ''}
                />
                {errors.ort && <FieldError msg={errors.ort} />}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <IconChevronLeft size={16} className="shrink-0" /> {tx('Zurück')}
              </Button>
              <Button onClick={goToStep3} className="gap-2">
                {tx('Weiter')} <IconChevronRight size={16} className="shrink-0" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Kontaktdaten + Absenden */}
        {step === 3 && (
          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vorname">
                  {tx('Vorname')}<RequiredMark />
                </Label>
                <Input
                  id="vorname"
                  type="text"
                  placeholder={tx('Max')}
                  value={form.vorname}
                  onChange={e => set('vorname', e.target.value)}
                  className={errors.vorname ? 'border-destructive' : ''}
                />
                {errors.vorname && <FieldError msg={errors.vorname} />}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nachname">
                  {tx('Nachname')}<RequiredMark />
                </Label>
                <Input
                  id="nachname"
                  type="text"
                  placeholder={tx('Mustermann')}
                  value={form.nachname}
                  onChange={e => set('nachname', e.target.value)}
                  className={errors.nachname ? 'border-destructive' : ''}
                />
                {errors.nachname && <FieldError msg={errors.nachname} />}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefon">
                {tx('Telefonnummer')}<RequiredMark />
              </Label>
              <Input
                id="telefon"
                type="tel"
                placeholder={tx('+49 30 12345678')}
                value={form.telefon}
                onChange={e => set('telefon', e.target.value)}
                className={errors.telefon ? 'border-destructive' : ''}
              />
              {errors.telefon && <FieldError msg={errors.telefon} />}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{tx('E-Mail-Adresse')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={tx('max@beispiel.de')}
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="erreichbarkeit">{tx('Beste Erreichbarkeit')}</Label>
              <Input
                id="erreichbarkeit"
                type="text"
                placeholder={tx('z. B. Montag bis Freitag, 9 – 17 Uhr')}
                value={form.erreichbarkeit}
                onChange={e => set('erreichbarkeit', e.target.value)}
              />
            </div>

            {submitError && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <IconAlertTriangle size={16} className="shrink-0" /> {submitError}
              </p>
            )}

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(2)} className="gap-2">
                <IconChevronLeft size={16} className="shrink-0" /> {tx('Zurück')}
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                <IconSend size={16} className="shrink-0" />
                {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
              </Button>
            </div>
          </form>
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
