import { useEffect, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import {
  loadPublicPagesConfig, createPublicRecord, prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { IconCheck, IconAlertCircle, IconLoader2 } from '@tabler/icons-react';

const SLUG = 'serviceanfrage';

type Dringlichkeit = 'nicht_dringend' | 'normal' | 'dringend' | 'notfall';

interface FormData {
  // Step 1
  problembeschreibung: string;
  dringlichkeit: Dringlichkeit | '';
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

const DRINGLICHKEIT_OPTIONS: { key: Dringlichkeit; label: string; description: string }[] = [
  { key: 'nicht_dringend', label: 'Nicht dringend', description: 'Kann warten' },
  { key: 'normal',         label: 'Normal',         description: 'Innerhalb der nächsten Tage' },
  { key: 'dringend',       label: 'Dringend',       description: 'So bald wie möglich' },
  { key: 'notfall',        label: 'Notfall',         description: 'Sofortiger Einsatz nötig' },
];

const TONE: Record<Dringlichkeit, string> = {
  nicht_dringend: 'border-slate-300 bg-slate-50 text-slate-700',
  normal:         'border-blue-300 bg-blue-50 text-blue-700',
  dringend:       'border-amber-300 bg-amber-50 text-amber-700',
  notfall:        'border-red-300 bg-red-50 text-red-700',
};

const TONE_SELECTED: Record<Dringlichkeit, string> = {
  nicht_dringend: 'border-slate-500 bg-slate-100 ring-2 ring-slate-400',
  normal:         'border-blue-500 bg-blue-100 ring-2 ring-blue-400',
  dringend:       'border-amber-500 bg-amber-100 ring-2 ring-amber-400',
  notfall:        'border-red-500 bg-red-100 ring-2 ring-red-400',
};

export default function Serviceanfrage() {
  const [cfg, setCfg]     = useState<PublicPagesConfig | null>(null);
  const [page, setPage]   = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep]   = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
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
  });

  // Step-level validation errors
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Warm up the challenge token on first interaction
  const handleFirstInteraction = () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  };

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(err => ({ ...err, [field]: undefined }));
  };

  // --- Validation per step ---
  function validateStep1(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.problembeschreibung.trim()) e.problembeschreibung = tx('Bitte beschreibe das Problem.');
    if (!form.dringlichkeit) e.dringlichkeit = tx('Bitte wähle eine Dringlichkeit aus.');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.strasse.trim())     e.strasse     = tx('Pflichtfeld');
    if (!form.hausnummer.trim())  e.hausnummer  = tx('Pflichtfeld');
    if (!form.plz.trim())         e.plz         = tx('Pflichtfeld');
    if (!form.ort.trim())         e.ort         = tx('Pflichtfeld');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep3(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.vorname.trim())  e.vorname  = tx('Pflichtfeld');
    if (!form.nachname.trim()) e.nachname = tx('Pflichtfeld');
    if (!form.telefon.trim())  e.telefon  = tx('Pflichtfeld');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = tx('Bitte gib eine gültige E-Mail-Adresse ein.');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const goNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  const goBack = () => setStep(s => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    if (!cfg || !page) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, string> = {
        problembeschreibung: form.problembeschreibung,
        dringlichkeit:       form.dringlichkeit,
        strasse:             form.strasse,
        hausnummer:          form.hausnummer,
        plz:                 form.plz,
        ort:                 form.ort,
        vorname:             form.vorname,
        nachname:            form.nachname,
        telefon:             form.telefon,
      };
      if (form.email)          payload.email          = form.email;
      if (form.erreichbarkeit) payload.erreichbarkeit = form.erreichbarkeit;

      await createPublicRecord(cfg, page, payload);
      setSubmitted(true);
    } catch {
      setSubmitError(tx('Beim Senden ist ein Fehler aufgetreten. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || (!loading && !page)) {
    return <PublicShell loading={loading} unavailable={!loading && !page} />;
  }

  if (submitted) {
    return (
      <PublicShell title={page?.title ?? tx('Serviceanfrage')}>
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCheck size={32} className="text-emerald-600" stroke={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">{tx('Vielen Dank!')}</h2>
            <p className="text-muted-foreground">
              {tx('Wir melden uns bald bei Ihnen.')}
            </p>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            {tx('Ihre Anfrage wurde erfolgreich übermittelt. Unser Team wird sich so schnell wie möglich bei Ihnen melden.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  const steps = [
    { label: tx('Ihr Anliegen') },
    { label: tx('Einsatzort') },
    { label: tx('Kontakt') },
  ];

  return (
    <PublicShell
      title={page?.title ?? tx('Serviceanfrage')}
      description={tx('Schildere uns Ihr Problem – wir kümmern uns darum.')}
      plain
    >
      <IntentWizardShell
        steps={steps}
        currentStep={step}
        onStepChange={setStep}
        back={false}
      >
        {/* ── Step 1: Ihr Anliegen ── */}
        {step === 1 && (
          <div
            className="rounded-[27px] bg-card shadow-lg p-6 sm:p-8 space-y-6"
            onFocus={handleFirstInteraction}
          >
            <div>
              <h2 className="text-lg font-semibold mb-1">{tx('Ihr Anliegen')}</h2>
              <p className="text-sm text-muted-foreground">
                {tx('Was ist das Problem? Je mehr Details, desto besser können wir helfen.')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="problembeschreibung">{tx('Problembeschreibung')} *</Label>
              <Textarea
                id="problembeschreibung"
                value={form.problembeschreibung}
                onChange={set('problembeschreibung')}
                placeholder={tx('z. B. Steckdose in der Küche gibt keinen Strom mehr …')}
                rows={5}
                className={errors.problembeschreibung ? 'border-destructive' : ''}
              />
              {errors.problembeschreibung && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <IconAlertCircle size={14} className="shrink-0" />
                  {errors.problembeschreibung}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{tx('Dringlichkeit')} *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DRINGLICHKEIT_OPTIONS.map(opt => {
                  const isSelected = form.dringlichkeit === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, dringlichkeit: opt.key }));
                        setErrors(e => ({ ...e, dringlichkeit: undefined }));
                      }}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected ? TONE_SELECTED[opt.key] : TONE[opt.key] + ' hover:opacity-80'
                      }`}
                    >
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className="text-xs opacity-75 mt-0.5">{opt.description}</div>
                    </button>
                  );
                })}
              </div>
              {errors.dringlichkeit && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <IconAlertCircle size={14} className="shrink-0" />
                  {errors.dringlichkeit}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={goNext}>{tx('Weiter')}</Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Einsatzort ── */}
        {step === 2 && (
          <div className="rounded-[27px] bg-card shadow-lg p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">{tx('Einsatzort')}</h2>
              <p className="text-sm text-muted-foreground">
                {tx('Wo soll der Elektriker eingesetzt werden?')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="strasse">{tx('Straße')} *</Label>
                <Input
                  id="strasse"
                  value={form.strasse}
                  onChange={set('strasse')}
                  placeholder={tx('Musterstraße')}
                  className={errors.strasse ? 'border-destructive' : ''}
                />
                {errors.strasse && (
                  <p className="text-sm text-destructive">{errors.strasse}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="hausnummer">{tx('Hausnummer')} *</Label>
                <Input
                  id="hausnummer"
                  value={form.hausnummer}
                  onChange={set('hausnummer')}
                  placeholder="12a"
                  className={errors.hausnummer ? 'border-destructive' : ''}
                />
                {errors.hausnummer && (
                  <p className="text-sm text-destructive">{errors.hausnummer}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plz">{tx('Postleitzahl')} *</Label>
                <Input
                  id="plz"
                  value={form.plz}
                  onChange={set('plz')}
                  placeholder="12345"
                  inputMode="numeric"
                  className={errors.plz ? 'border-destructive' : ''}
                />
                {errors.plz && (
                  <p className="text-sm text-destructive">{errors.plz}</p>
                )}
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="ort">{tx('Stadt / Ort')} *</Label>
                <Input
                  id="ort"
                  value={form.ort}
                  onChange={set('ort')}
                  placeholder={tx('Musterstadt')}
                  className={errors.ort ? 'border-destructive' : ''}
                />
                {errors.ort && (
                  <p className="text-sm text-destructive">{errors.ort}</p>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goBack}>{tx('Zurück')}</Button>
              <Button onClick={goNext}>{tx('Weiter')}</Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Kontakt ── */}
        {step === 3 && (
          <div className="rounded-[27px] bg-card shadow-lg p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">{tx('Ihre Kontaktdaten')}</h2>
              <p className="text-sm text-muted-foreground">
                {tx('Damit wir uns bei Ihnen melden können.')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vorname">{tx('Vorname')} *</Label>
                <Input
                  id="vorname"
                  value={form.vorname}
                  onChange={set('vorname')}
                  autoComplete="given-name"
                  className={errors.vorname ? 'border-destructive' : ''}
                />
                {errors.vorname && (
                  <p className="text-sm text-destructive">{errors.vorname}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nachname">{tx('Nachname')} *</Label>
                <Input
                  id="nachname"
                  value={form.nachname}
                  onChange={set('nachname')}
                  autoComplete="family-name"
                  className={errors.nachname ? 'border-destructive' : ''}
                />
                {errors.nachname && (
                  <p className="text-sm text-destructive">{errors.nachname}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefon">{tx('Telefonnummer')} *</Label>
              <Input
                id="telefon"
                type="tel"
                value={form.telefon}
                onChange={set('telefon')}
                placeholder="+49 123 456789"
                autoComplete="tel"
                className={errors.telefon ? 'border-destructive' : ''}
              />
              {errors.telefon && (
                <p className="text-sm text-destructive">{errors.telefon}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                {tx('E-Mail-Adresse')}
                <span className="text-muted-foreground font-normal ml-1">{tx('(optional)')}</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <IconAlertCircle size={14} className="shrink-0" />
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="erreichbarkeit">
                {tx('Beste Erreichbarkeit')}
                <span className="text-muted-foreground font-normal ml-1">{tx('(optional)')}</span>
              </Label>
              <Input
                id="erreichbarkeit"
                value={form.erreichbarkeit}
                onChange={set('erreichbarkeit')}
                placeholder={tx('z. B. Werktags ab 14 Uhr')}
              />
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goBack} disabled={submitting}>
                {tx('Zurück')}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin shrink-0 mr-2" />
                    {tx('Wird gesendet …')}
                  </>
                ) : (
                  tx('Anfrage absenden')
                )}
              </Button>
            </div>
          </div>
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
