import { useEffect, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, createPublicRecord,
  prepareChallenge, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

// ── Typen ────────────────────────────────────────────────────────────────────

interface FormState {
  problembeschreibung: string;
  dringlichkeit: string;
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

const DRINGLICHKEIT_OPTIONS: { key: string; label: string }[] = [
  { key: 'nicht_dringend', label: '' },
  { key: 'normal',         label: '' },
  { key: 'dringend',       label: '' },
  { key: 'notfall',        label: '' },
];

// ── Hauptkomponente ──────────────────────────────────────────────────────────

export default function Anfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
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

  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    loadPublicPagesConfig('anfrage').then(c => {
      setCfg(c);
      setPage(c?.pages['anfrage'] ?? null);
      setLoading(false);
    }).catch(err => {
      if (err instanceof PageUnavailableError) setUnavailable(true);
      setLoading(false);
    });
  }, []);

  // challenge warm-up on first interaction
  const handleFirstInteraction = () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (!ep) return;
    prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  };

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  // ── Validierung Schritt 1 ────────────────────────────────────────────────
  const validateStep1 = () => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.problembeschreibung.trim())
      errs.problembeschreibung = tx('Bitte beschreibe das Problem.');
    if (!form.dringlichkeit)
      errs.dringlichkeit = tx('Bitte wähle die Dringlichkeit aus.');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Validierung Schritt 2 ────────────────────────────────────────────────
  const validateStep2 = () => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.strasse.trim())  errs.strasse  = tx('Bitte gib die Straße ein.');
    if (!form.hausnummer.trim()) errs.hausnummer = tx('Bitte gib die Hausnummer ein.');
    if (!form.plz.trim())     errs.plz      = tx('Bitte gib die PLZ ein.');
    if (!form.ort.trim())     errs.ort      = tx('Bitte gib den Ort ein.');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Validierung Schritt 3 ────────────────────────────────────────────────
  const validateStep3 = () => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.vorname.trim())  errs.vorname  = tx('Bitte gib deinen Vornamen ein.');
    if (!form.nachname.trim()) errs.nachname = tx('Bitte gib deinen Nachnamen ein.');
    if (!form.telefon.trim())  errs.telefon  = tx('Bitte gib deine Telefonnummer ein.');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToStep2 = () => {
    if (validateStep1()) setStep(2);
  };

  const goToStep3 = () => {
    if (validateStep2()) setStep(3);
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    if (!cfg || !page) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await createPublicRecord(cfg, page, {
        problembeschreibung: form.problembeschreibung,
        dringlichkeit: form.dringlichkeit,
        strasse: form.strasse,
        hausnummer: form.hausnummer,
        plz: form.plz,
        ort: form.ort,
        vorname: form.vorname,
        nachname: form.nachname,
        telefon: form.telefon,
        email: form.email || undefined,
        erreichbarkeit: form.erreichbarkeit || undefined,
      });
      setSubmitted(true);
    } catch (_err) {
      setSubmitError(tx('Die Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (unavailable) return <PublicShell unavailable />;
  if (loading || !cfg || !page) return <PublicShell loading={loading} unavailable={!loading} />;

  // Dringlichkeit-Labels (inline — locale-aware, called in component body)
  const dringlichkeitLabels: Record<string, string> = {
    nicht_dringend: tx('Nicht dringend'),
    normal:         tx('Normal'),
    dringend:       tx('Dringend'),
    notfall:        tx('Notfall'),
  };

  const steps = [
    { label: tx('Problem') },
    { label: tx('Einsatzort') },
    { label: tx('Kontakt') },
  ];

  if (submitted) {
    return (
      <PublicShell title={tx('Serviceanfrage')}>
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCheck size={32} className="text-emerald-600" stroke={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {tx('Anfrage erfolgreich gesendet!')}
            </h2>
            <p className="text-muted-foreground max-w-sm">
              {tx('Vielen Dank! Wir haben deine Anfrage erhalten und melden uns so schnell wie möglich bei dir.')}
            </p>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      title={tx('Serviceanfrage')}
      description={tx('Beschreibe dein Problem — wir kommen zu dir.')}
    >
      <div onFocus={handleFirstInteraction}>
        <IntentWizardShell
          steps={steps}
          currentStep={step}
          onStepChange={setStep}
          back={false}
        >
          {/* ── Schritt 1: Problem & Dringlichkeit ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="problembeschreibung">
                  {tx('Was ist kaputt oder was liegt an?')}
                  <span className="text-destructive ml-1" aria-hidden>*</span>
                </Label>
                <Textarea
                  id="problembeschreibung"
                  rows={5}
                  placeholder={tx('Beschreibe das Problem so genau wie möglich …')}
                  value={form.problembeschreibung}
                  onChange={set('problembeschreibung')}
                  className={errors.problembeschreibung ? 'border-destructive' : ''}
                />
                {errors.problembeschreibung && (
                  <p className="text-xs text-destructive">{errors.problembeschreibung}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  {tx('Wie dringend ist es?')}
                  <span className="text-destructive ml-1" aria-hidden>*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {DRINGLICHKEIT_OPTIONS.map(opt => {
                    const label = dringlichkeitLabels[opt.key] ?? opt.key;
                    const selected = form.dringlichkeit === opt.key;
                    const toneClass =
                      opt.key === 'notfall'   ? 'border-red-500 bg-red-50 text-red-700'     :
                      opt.key === 'dringend'  ? 'border-amber-500 bg-amber-50 text-amber-700' :
                      opt.key === 'normal'    ? 'border-blue-500 bg-blue-50 text-blue-700'   :
                      'border-muted bg-muted/40 text-muted-foreground';
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, dringlichkeit: opt.key }));
                          setErrors(er => ({ ...er, dringlichkeit: undefined }));
                        }}
                        className={`rounded-xl border-2 p-3 text-sm font-medium text-left transition-all ${
                          selected ? toneClass : 'border-border bg-card text-foreground hover:border-primary/50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {errors.dringlichkeit && (
                  <p className="text-xs text-destructive">{errors.dringlichkeit}</p>
                )}
              </div>

              <Button className="w-full" onClick={goToStep2}>
                {tx('Weiter')}
              </Button>
            </div>
          )}

          {/* ── Schritt 2: Einsatzort ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="strasse">
                    {tx('Straße')}
                    <span className="text-destructive ml-1" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="strasse"
                    placeholder={tx('Musterstraße')}
                    value={form.strasse}
                    onChange={set('strasse')}
                    className={errors.strasse ? 'border-destructive' : ''}
                  />
                  {errors.strasse && (
                    <p className="text-xs text-destructive">{errors.strasse}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hausnummer">
                    {tx('Nr.')}
                    <span className="text-destructive ml-1" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="hausnummer"
                    placeholder="12a"
                    value={form.hausnummer}
                    onChange={set('hausnummer')}
                    className={errors.hausnummer ? 'border-destructive' : ''}
                  />
                  {errors.hausnummer && (
                    <p className="text-xs text-destructive">{errors.hausnummer}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="plz">
                    {tx('PLZ')}
                    <span className="text-destructive ml-1" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="plz"
                    placeholder="12345"
                    value={form.plz}
                    onChange={set('plz')}
                    className={errors.plz ? 'border-destructive' : ''}
                  />
                  {errors.plz && (
                    <p className="text-xs text-destructive">{errors.plz}</p>
                  )}
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ort">
                    {tx('Ort')}
                    <span className="text-destructive ml-1" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="ort"
                    placeholder={tx('Musterstadt')}
                    value={form.ort}
                    onChange={set('ort')}
                    className={errors.ort ? 'border-destructive' : ''}
                  />
                  {errors.ort && (
                    <p className="text-xs text-destructive">{errors.ort}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  {tx('Zurück')}
                </Button>
                <Button className="flex-1" onClick={goToStep3}>
                  {tx('Weiter')}
                </Button>
              </div>
            </div>
          )}

          {/* ── Schritt 3: Kontaktdaten & Absenden ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vorname">
                    {tx('Vorname')}
                    <span className="text-destructive ml-1" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="vorname"
                    placeholder={tx('Max')}
                    value={form.vorname}
                    onChange={set('vorname')}
                    className={errors.vorname ? 'border-destructive' : ''}
                  />
                  {errors.vorname && (
                    <p className="text-xs text-destructive">{errors.vorname}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nachname">
                    {tx('Nachname')}
                    <span className="text-destructive ml-1" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="nachname"
                    placeholder={tx('Mustermann')}
                    value={form.nachname}
                    onChange={set('nachname')}
                    className={errors.nachname ? 'border-destructive' : ''}
                  />
                  {errors.nachname && (
                    <p className="text-xs text-destructive">{errors.nachname}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="telefon">
                  {tx('Telefon')}
                  <span className="text-destructive ml-1" aria-hidden>*</span>
                </Label>
                <Input
                  id="telefon"
                  type="tel"
                  placeholder="+49 170 1234567"
                  value={form.telefon}
                  onChange={set('telefon')}
                  className={errors.telefon ? 'border-destructive' : ''}
                />
                {errors.telefon && (
                  <p className="text-xs text-destructive">{errors.telefon}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">
                  {tx('E-Mail')}
                  <span className="text-muted-foreground text-xs ml-1">({tx('optional')})</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="max@beispiel.de"
                  value={form.email}
                  onChange={set('email')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="erreichbarkeit">
                  {tx('Wann bist du am besten erreichbar?')}
                  <span className="text-muted-foreground text-xs ml-1">({tx('optional')})</span>
                </Label>
                <Input
                  id="erreichbarkeit"
                  placeholder={tx('z. B. werktags 8–12 Uhr')}
                  value={form.erreichbarkeit}
                  onChange={set('erreichbarkeit')}
                />
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                  <IconAlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{submitError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)} disabled={submitting}>
                  {tx('Zurück')}
                </Button>
                <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
                </Button>
              </div>
            </div>
          )}
        </IntentWizardShell>
      </div>
    </PublicShell>
  );
}
