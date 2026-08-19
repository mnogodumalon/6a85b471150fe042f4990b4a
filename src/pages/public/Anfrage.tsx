import { useEffect, useRef, useState } from 'react';
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
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconBolt,
} from '@tabler/icons-react';

// Slug: anfrage
// Flow: 3-Schritt-Wizard — 1) Problem beschreiben, 2) Einsatzort, 3) Kontaktdaten

interface FormData {
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

const DRINGLICHKEIT_TONE: Record<string, string> = {
  nicht_dringend: 'border-slate-200 bg-slate-50 text-slate-700',
  normal: 'border-blue-200 bg-blue-50 text-blue-800',
  dringend: 'border-amber-300 bg-amber-50 text-amber-800',
  notfall: 'border-red-300 bg-red-50 text-red-800',
};

const DRINGLICHKEIT_SELECTED: Record<string, string> = {
  nicht_dringend: 'border-slate-500 bg-slate-100 ring-2 ring-slate-400',
  normal: 'border-blue-500 bg-blue-100 ring-2 ring-blue-400',
  dringend: 'border-amber-500 bg-amber-100 ring-2 ring-amber-500',
  notfall: 'border-red-500 bg-red-100 ring-2 ring-red-500',
};

export default function Anfrage() {
  const DRINGLICHKEIT_OPTIONS = [
  { key: 'nicht_dringend', label: tx('Nicht dringend – kann warten') },
  { key: 'normal', label: tx('Normal – innerhalb der nächsten Tage') },
  { key: 'dringend', label: tx('Dringend – so bald wie möglich') },
  { key: 'notfall', label: tx('Notfall – sofortiger Einsatz nötig') },
] as const;

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep] = useState(1);
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
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const topRef = useRef<HTMLDivElement>(null);

  // All hooks before any early return
  useEffect(() => {
    loadPublicPagesConfig('anfrage')
      .then(c => {
        setCfg(c);
        setPage(c?.pages['anfrage'] ?? null);
        setLoading(false);
        if (!c?.pages['anfrage']) setUnavailable(true);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={unavailable} />;
  }

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function set(key: keyof FormData, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validateStep1(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.problembeschreibung.trim()) e.problembeschreibung = tx('Bitte beschreibe das Problem.');
    if (!form.dringlichkeit) e.dringlichkeit = tx('Bitte wähle eine Dringlichkeit.');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.strasse.trim()) e.strasse = tx('Bitte gib die Straße an.');
    if (!form.hausnummer.trim()) e.hausnummer = tx('Bitte gib die Hausnummer an.');
    if (!form.plz.trim()) e.plz = tx('Bitte gib die Postleitzahl an.');
    if (!form.ort.trim()) e.ort = tx('Bitte gib den Ort an.');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep3(): boolean {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.vorname.trim()) e.vorname = tx('Bitte gib deinen Vornamen an.');
    if (!form.nachname.trim()) e.nachname = tx('Bitte gib deinen Nachnamen an.');
    if (!form.telefon.trim()) e.telefon = tx('Bitte gib deine Telefonnummer an.');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = tx('Bitte gib eine gültige E-Mail-Adresse ein.');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function goNext() {
    const valid = step === 1 ? validateStep1() : step === 2 ? validateStep2() : false;
    if (!valid) return;
    if (step === 2) {
      // Warm up challenge before last step
      const ep = (page as PublicPageConfig).endpoints?.find(e => e.op === 'create');
      if (ep) prepareChallenge(cfg as PublicPagesConfig, page as PublicPageConfig, 'POST', `/apps/${ep.app_id}/records`);
    }
    setStep(s => s + 1);
    scrollTop();
  }

  function goBack() {
    setStep(s => s - 1);
    scrollTop();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep3()) return;
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

      await createPublicRecord(cfg as PublicPagesConfig, page as PublicPageConfig, payload);
      setSubmitted(true);
      scrollTop();
    } catch {
      setSubmitError(tx('Die Anfrage konnte nicht übermittelt werden. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  }

  const steps = [
    tx('Problem'),
    tx('Einsatzort'),
    tx('Kontakt'),
  ];

  if (submitted) {
    return (
      <PublicShell title={tx('Serviceanfrage')} description={tx('Elektro-Service – schnell & zuverlässig')}>
        <div ref={topRef} className="rounded-2xl bg-card border border-border p-8 text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCheck size={28} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-medium">{tx('Anfrage eingegangen!')}</h2>
          <p className="text-muted-foreground max-w-sm">
            {tx('Vielen Dank! Wir melden uns so bald wie möglich bei dir.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      title={tx('Serviceanfrage')}
      description={tx('Elektro-Service – schnell & zuverlässig')}
    >
      <div ref={topRef} />

      {/* Stepper */}
      <div className="flex items-center justify-between mb-8 px-1">
        {steps.map((label, idx) => {
          const num = idx + 1;
          const done = step > num;
          const active = step === num;
          return (
            <div key={num} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {done ? <IconCheck size={15} /> : num}
                </div>
                <span className={['text-xs', active ? 'text-foreground font-medium' : 'text-muted-foreground'].join(' ')}>
                  {label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={['flex-1 h-px mx-2 mb-5 transition-colors', done ? 'bg-emerald-400' : 'bg-muted'].join(' ')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Problem beschreiben */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl bg-card border border-border p-5 sm:p-6 flex flex-col gap-5">
            <h2 className="text-base font-medium">{tx('Was ist das Problem?')}</h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {tx('Problembeschreibung')} <span className="text-red-500">*</span>
              </label>
              <textarea
                className={[
                  'w-full min-h-[120px] rounded-lg border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary transition',
                  errors.problembeschreibung ? 'border-red-400' : 'border-border',
                ].join(' ')}
                placeholder={tx('Beschreibe das elektrische Problem so genau wie möglich …')}
                value={form.problembeschreibung}
                onChange={e => set('problembeschreibung', e.target.value)}
              />
              {errors.problembeschreibung && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <IconAlertCircle size={13} className="shrink-0" />
                  {errors.problembeschreibung}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                {tx('Dringlichkeit')} <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col gap-2">
                {DRINGLICHKEIT_OPTIONS.map(opt => {
                  const selected = form.dringlichkeit === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => set('dringlichkeit', opt.key)}
                      className={[
                        'w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all cursor-pointer',
                        selected ? DRINGLICHKEIT_SELECTED[opt.key] : DRINGLICHKEIT_TONE[opt.key],
                      ].join(' ')}
                    >
                      {opt.key === 'notfall' && <IconBolt size={14} className="inline mr-1 mb-0.5 shrink-0" />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {errors.dringlichkeit && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <IconAlertCircle size={13} className="shrink-0" />
                  {errors.dringlichkeit}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition"
            >
              {tx('Weiter')}
              <IconArrowRight size={16} className="shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Einsatzort */}
      {step === 2 && (
        <form
          onSubmit={e => { e.preventDefault(); goNext(); }}
          className="flex flex-col gap-5"
          noValidate
        >
          <div className="rounded-2xl bg-card border border-border p-5 sm:p-6 flex flex-col gap-5">
            <h2 className="text-base font-medium">{tx('Wo liegt der Einsatzort?')}</h2>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <label className="text-sm font-medium">
                  {tx('Straße')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={[
                    'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition',
                    errors.strasse ? 'border-red-400' : 'border-border',
                  ].join(' ')}
                  placeholder={tx('Musterstraße')}
                  value={form.strasse}
                  onChange={e => set('strasse', e.target.value)}
                />
                {errors.strasse && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <IconAlertCircle size={13} className="shrink-0" />
                    {errors.strasse}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 w-24">
                <label className="text-sm font-medium">
                  {tx('Nr.')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={[
                    'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition',
                    errors.hausnummer ? 'border-red-400' : 'border-border',
                  ].join(' ')}
                  placeholder="12a"
                  value={form.hausnummer}
                  onChange={e => set('hausnummer', e.target.value)}
                />
                {errors.hausnummer && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <IconAlertCircle size={13} className="shrink-0" />
                    {errors.hausnummer}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 w-28">
                <label className="text-sm font-medium">
                  {tx('PLZ')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={[
                    'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition',
                    errors.plz ? 'border-red-400' : 'border-border',
                  ].join(' ')}
                  placeholder="12345"
                  maxLength={10}
                  value={form.plz}
                  onChange={e => set('plz', e.target.value)}
                />
                {errors.plz && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <IconAlertCircle size={13} className="shrink-0" />
                    {errors.plz}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <label className="text-sm font-medium">
                  {tx('Ort')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={[
                    'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition',
                    errors.ort ? 'border-red-400' : 'border-border',
                  ].join(' ')}
                  placeholder={tx('Musterstadt')}
                  value={form.ort}
                  onChange={e => set('ort', e.target.value)}
                />
                {errors.ort && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <IconAlertCircle size={13} className="shrink-0" />
                    {errors.ort}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <IconArrowLeft size={16} className="shrink-0" />
              {tx('Zurück')}
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition"
            >
              {tx('Weiter')}
              <IconArrowRight size={16} className="shrink-0" />
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Kontaktdaten */}
      {step === 3 && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <div className="rounded-2xl bg-card border border-border p-5 sm:p-6 flex flex-col gap-5">
            <h2 className="text-base font-medium">{tx('Wie können wir dich erreichen?')}</h2>

            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <label className="text-sm font-medium">
                  {tx('Vorname')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="given-name"
                  className={[
                    'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition',
                    errors.vorname ? 'border-red-400' : 'border-border',
                  ].join(' ')}
                  placeholder={tx('Maria')}
                  value={form.vorname}
                  onChange={e => set('vorname', e.target.value)}
                />
                {errors.vorname && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <IconAlertCircle size={13} className="shrink-0" />
                    {errors.vorname}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <label className="text-sm font-medium">
                  {tx('Nachname')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="family-name"
                  className={[
                    'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition',
                    errors.nachname ? 'border-red-400' : 'border-border',
                  ].join(' ')}
                  placeholder={tx('Mustermann')}
                  value={form.nachname}
                  onChange={e => set('nachname', e.target.value)}
                />
                {errors.nachname && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <IconAlertCircle size={13} className="shrink-0" />
                    {errors.nachname}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {tx('Telefonnummer')} <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                autoComplete="tel"
                className={[
                  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition',
                  errors.telefon ? 'border-red-400' : 'border-border',
                ].join(' ')}
                placeholder="+49 123 456789"
                value={form.telefon}
                onChange={e => set('telefon', e.target.value)}
              />
              {errors.telefon && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <IconAlertCircle size={13} className="shrink-0" />
                  {errors.telefon}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{tx('E-Mail-Adresse')}</label>
              <input
                type="email"
                autoComplete="email"
                className={[
                  'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition',
                  errors.email ? 'border-red-400' : 'border-border',
                ].join(' ')}
                placeholder={tx('maria@beispiel.de')}
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
              {errors.email && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <IconAlertCircle size={13} className="shrink-0" />
                  {errors.email}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{tx('Beste Erreichbarkeit')}</label>
              <input
                type="text"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition"
                placeholder={tx('z. B. Werktags 8–17 Uhr')}
                value={form.erreichbarkeit}
                onChange={e => set('erreichbarkeit', e.target.value)}
              />
            </div>
          </div>

          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
              {submitError}
            </div>
          )}

          <div className="flex justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-50"
            >
              <IconArrowLeft size={16} className="shrink-0" />
              {tx('Zurück')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin shrink-0" />
                  {tx('Wird gesendet …')}
                </>
              ) : (
                <>
                  <IconCheck size={16} className="shrink-0" />
                  {tx('Anfrage absenden')}
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </PublicShell>
  );
}
