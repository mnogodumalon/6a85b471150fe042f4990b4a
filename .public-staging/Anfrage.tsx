import { useEffect, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
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
  IconAlertCircle,
  IconArrowRight,
  IconArrowLeft,
  IconCheck,
  IconBolt,
  IconMapPin,
  IconPhone,
} from '@tabler/icons-react';

// --- Types ---

interface FormState {
  // Step 1
  problembeschreibung: string;
  dringlichkeit: '' | 'nicht_dringend' | 'normal' | 'dringend' | 'notfall';
  // Step 2
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  // Step 3
  vorname: string;
  nachname: string;
  telefon: string;
  email: string;
  erreichbarkeit: string;
}

const EMPTY_FORM: FormState = {
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

// Dringlichkeit options — must match the lookup keys in app_metadata
const DRINGLICHKEIT_OPTIONS: { key: FormState['dringlichkeit']; label: string; tone: string }[] = [
  { key: 'nicht_dringend', label: 'Nicht dringend – kann warten', tone: 'border-slate-200 hover:border-slate-400' },
  { key: 'normal', label: 'Normal – innerhalb der nächsten Tage', tone: 'border-blue-200 hover:border-blue-400' },
  { key: 'dringend', label: 'Dringend – so bald wie möglich', tone: 'border-amber-200 hover:border-amber-400' },
  { key: 'notfall', label: 'Notfall – sofortiger Einsatz nötig', tone: 'border-red-300 hover:border-red-500' },
];

// --- Step indicator ---

function StepIndicator({ current, total }: { current: number; total: number }) {
  const stepLabels = [
    tx('Problem'),
    tx('Einsatzort'),
    tx('Kontakt'),
  ];
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div
              className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors',
                done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              ].join(' ')}
            >
              {done ? <IconCheck size={16} /> : n}
            </div>
            <span
              className={[
                'text-sm hidden sm:inline',
                active ? 'font-medium text-foreground' : 'text-muted-foreground',
              ].join(' ')}
            >
              {stepLabels[i]}
            </span>
            {n < total && (
              <div className={['w-8 h-px mx-1', done ? 'bg-emerald-400' : 'bg-border'].join(' ')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Field wrapper ---

function Field({ label, required, error, children }: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <IconAlertCircle size={12} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// --- Step 1: Problem ---

function Step1({
  form,
  onChange,
  errors,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-primary mb-1">
        <IconBolt size={20} className="shrink-0" />
        <span className="font-semibold text-base">{tx('Was ist passiert?')}</span>
      </div>

      <Field label={tx('Problembeschreibung')} required error={errors.problembeschreibung}>
        <Textarea
          value={form.problembeschreibung}
          onChange={e => onChange({ problembeschreibung: e.target.value })}
          placeholder={tx('Beschreiben Sie bitte das Problem möglichst genau …')}
          rows={4}
          className="resize-none"
        />
      </Field>

      <Field label={tx('Dringlichkeit')} required error={errors.dringlichkeit}>
        <div className="grid grid-cols-1 gap-2">
          {DRINGLICHKEIT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange({ dringlichkeit: opt.key })}
              className={[
                'flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-colors w-full',
                form.dringlichkeit === opt.key
                  ? 'border-primary bg-primary/5 font-medium'
                  : opt.tone,
              ].join(' ')}
            >
              <div
                className={[
                  'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                  form.dringlichkeit === opt.key ? 'border-primary' : 'border-muted-foreground/40',
                ].join(' ')}
              >
                {form.dringlichkeit === opt.key && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm leading-snug">{opt.label}</span>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

// --- Step 2: Einsatzort ---

function Step2({
  form,
  onChange,
  errors,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-primary mb-1">
        <IconMapPin size={20} className="shrink-0" />
        <span className="font-semibold text-base">{tx('Wo soll der Elektriker hin?')}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label={tx('Straße')} required error={errors.strasse}>
            <Input
              value={form.strasse}
              onChange={e => onChange({ strasse: e.target.value })}
              placeholder={tx('Musterstraße')}
              autoComplete="address-line1"
            />
          </Field>
        </div>
        <Field label={tx('Hausnummer')} required error={errors.hausnummer}>
          <Input
            value={form.hausnummer}
            onChange={e => onChange({ hausnummer: e.target.value })}
            placeholder="12a"
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={tx('PLZ')} required error={errors.plz}>
          <Input
            value={form.plz}
            onChange={e => onChange({ plz: e.target.value })}
            placeholder="12345"
            inputMode="numeric"
            maxLength={10}
            autoComplete="postal-code"
          />
        </Field>
        <Field label={tx('Ort')} required error={errors.ort}>
          <Input
            value={form.ort}
            onChange={e => onChange({ ort: e.target.value })}
            placeholder={tx('Musterstadt')}
            autoComplete="address-level2"
          />
        </Field>
      </div>
    </div>
  );
}

// --- Step 3: Kontakt ---

function Step3({
  form,
  onChange,
  errors,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  errors: Partial<Record<keyof FormState, string>>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-primary mb-1">
        <IconPhone size={20} className="shrink-0" />
        <span className="font-semibold text-base">{tx('Wie erreichen wir Sie?')}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={tx('Vorname')} required error={errors.vorname}>
          <Input
            value={form.vorname}
            onChange={e => onChange({ vorname: e.target.value })}
            placeholder={tx('Max')}
            autoComplete="given-name"
          />
        </Field>
        <Field label={tx('Nachname')} required error={errors.nachname}>
          <Input
            value={form.nachname}
            onChange={e => onChange({ nachname: e.target.value })}
            placeholder={tx('Mustermann')}
            autoComplete="family-name"
          />
        </Field>
      </div>

      <Field label={tx('Telefonnummer')} required error={errors.telefon}>
        <Input
          value={form.telefon}
          onChange={e => onChange({ telefon: e.target.value })}
          placeholder="+49 123 4567890"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
        />
      </Field>

      <Field label={tx('E-Mail-Adresse')} error={errors.email}>
        <Input
          value={form.email}
          onChange={e => onChange({ email: e.target.value })}
          placeholder="max.mustermann@beispiel.de"
          type="email"
          autoComplete="email"
          inputMode="email"
        />
      </Field>

      <Field label={tx('Beste Erreichbarkeit')} error={errors.erreichbarkeit}>
        <Input
          value={form.erreichbarkeit}
          onChange={e => onChange({ erreichbarkeit: e.target.value })}
          placeholder={tx('z. B. Mo–Fr 9–17 Uhr, oder: jederzeit')}
          autoComplete="off"
        />
      </Field>
    </div>
  );
}

// --- Confirmation ---

function Confirmation({ form }: { form: FormState }) {
  const dring = DRINGLICHKEIT_OPTIONS.find(o => o.key === form.dringlichkeit);
  return (
    <div className="flex flex-col items-center text-center gap-5 py-4">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
        <IconCheck size={32} className="text-emerald-500" stroke={2} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">{tx('Anfrage eingegangen!')}</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          {tx('Vielen Dank, ')}
          <span className="font-medium text-foreground">{form.vorname} {form.nachname}</span>
          {tx('. Wir haben Ihre Serviceanfrage erhalten und melden uns so bald wie möglich bei Ihnen.')}
        </p>
      </div>
      <div className="w-full text-left rounded-xl bg-muted/50 border border-border p-4 space-y-2 text-sm">
        <div className="font-medium text-foreground mb-2">{tx('Ihre Angaben im Überblick')}</div>
        <div className="flex gap-2">
          <span className="text-muted-foreground shrink-0 w-28">{tx('Dringlichkeit')}</span>
          <span className="font-medium">{dring?.label ?? form.dringlichkeit}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground shrink-0 w-28">{tx('Einsatzort')}</span>
          <span className="font-medium">{form.strasse} {form.hausnummer}, {form.plz} {form.ort}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground shrink-0 w-28">{tx('Telefon')}</span>
          <span className="font-medium">{form.telefon}</span>
        </div>
        {form.email && (
          <div className="flex gap-2">
            <span className="text-muted-foreground shrink-0 w-28">{tx('E-Mail')}</span>
            <span className="font-medium">{form.email}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Validate per step ---

function validate(form: FormState, step: number): Partial<Record<keyof FormState, string>> {
  const err: Partial<Record<keyof FormState, string>> = {};
  if (step === 1) {
    if (!form.problembeschreibung.trim()) err.problembeschreibung = 'Bitte beschreiben Sie das Problem.';
    if (!form.dringlichkeit) err.dringlichkeit = 'Bitte wählen Sie eine Dringlichkeit.';
  }
  if (step === 2) {
    if (!form.strasse.trim()) err.strasse = 'Bitte geben Sie die Straße an.';
    if (!form.hausnummer.trim()) err.hausnummer = 'Bitte geben Sie die Hausnummer an.';
    if (!form.plz.trim()) err.plz = 'Bitte geben Sie die Postleitzahl an.';
    if (!form.ort.trim()) err.ort = 'Bitte geben Sie den Ort an.';
  }
  if (step === 3) {
    if (!form.vorname.trim()) err.vorname = 'Bitte geben Sie Ihren Vornamen an.';
    if (!form.nachname.trim()) err.nachname = 'Bitte geben Sie Ihren Nachnamen an.';
    if (!form.telefon.trim()) err.telefon = 'Bitte geben Sie Ihre Telefonnummer an.';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) err.email = 'Bitte geben Sie eine gültige E-Mail-Adresse an.';
  }
  return err;
}

// --- Main component ---

export default function Anfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loadingCfg, setLoadingCfg] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const TOTAL_STEPS = 3;

  useEffect(() => {
    loadPublicPagesConfig('anfrage')
      .then(c => {
        setCfg(c);
        setPage(c?.pages['anfrage'] ?? null);
        setLoadingCfg(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoadingCfg(false);
      });
  }, []);

  const handleChange = (patch: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...patch }));
    // Clear errors for changed fields
    const cleared = Object.fromEntries(Object.keys(patch).map(k => [k, undefined]));
    setErrors(prev => ({ ...prev, ...cleared }));
    // Warm up challenge on first interaction
    if (cfg && page) {
      const ep = page.endpoints?.find(e => e.op === 'create');
      if (ep) prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  };

  const handleNext = () => {
    const errs = validate(form, step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    const errs = validate(form, 3);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    if (!cfg || !page) return;
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
      setDone(true);
    } catch {
      setSubmitError('Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCfg || unavailable) {
    return <PublicShell loading={loadingCfg} unavailable={unavailable} />;
  }

  if (!cfg || !page) {
    return <PublicShell unavailable />;
  }

  if (done) {
    return (
      <PublicShell title={tx('Serviceanfrage')} description={tx('Elektrikerservice – schnell & zuverlässig')}>
        <Confirmation form={form} />
      </PublicShell>
    );
  }

  return (
    <PublicShell
      title={tx('Serviceanfrage')}
      description={tx('Schildern Sie uns Ihr Anliegen – wir melden uns so schnell wie möglich.')}
    >
      <StepIndicator current={step} total={TOTAL_STEPS} />

      <div className="space-y-6">
        {step === 1 && <Step1 form={form} onChange={handleChange} errors={errors} />}
        {step === 2 && <Step2 form={form} onChange={handleChange} errors={errors} />}
        {step === 3 && <Step3 form={form} onChange={handleChange} errors={errors} />}

        {submitError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {step > 1 ? (
            <Button type="button" variant="ghost" onClick={handleBack} disabled={submitting}>
              <IconArrowLeft size={16} className="shrink-0" />
              {tx('Zurück')}
            </Button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS ? (
            <Button type="button" onClick={handleNext}>
              {tx('Weiter')}
              <IconArrowRight size={16} className="shrink-0" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
              {!submitting && <IconCheck size={16} className="shrink-0" />}
            </Button>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
