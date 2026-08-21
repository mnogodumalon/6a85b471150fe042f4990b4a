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

// --- Types ---

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

const DRINGLICHKEIT_OPTIONS = [
  { key: 'nicht_dringend', label: tx('Nicht dringend – kann warten') },
  { key: 'normal', label: tx('Normal – innerhalb der nächsten Tage') },
  { key: 'dringend', label: tx('Dringend – so bald wie möglich') },
  { key: 'notfall', label: tx('Notfall – sofortiger Einsatz nötig') },
];

// --- Component ---

export default function Anfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const challengePrepared = useRef(false);

  useEffect(() => {
    loadPublicPagesConfig('anfrage').then(c => {
      setCfg(c);
      setPage(c?.pages['anfrage'] ?? null);
      setLoading(false);
    }).catch(err => {
      if (err instanceof PageUnavailableError) {
        setUnavailable(true);
      }
      setLoading(false);
    });
  }, []);

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading && (unavailable || !page)} />;
  }

  const ep = page.endpoints?.find(e => e.op === 'create');

  function handleFirstInteraction() {
    if (!challengePrepared.current && cfg && page && ep?.app_id) {
      challengePrepared.current = true;
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  }

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      handleFirstInteraction();
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setErrors(prev => ({ ...prev, [field]: undefined }));
    };
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.problembeschreibung.trim()) next.problembeschreibung = tx('Bitte beschreibe das Problem.');
    if (!form.dringlichkeit) next.dringlichkeit = tx('Bitte wähle eine Dringlichkeit.');
    if (!form.strasse.trim()) next.strasse = tx('Bitte gib die Straße an.');
    if (!form.hausnummer.trim()) next.hausnummer = tx('Bitte gib die Hausnummer an.');
    if (!form.plz.trim()) next.plz = tx('Bitte gib die Postleitzahl an.');
    if (!form.ort.trim()) next.ort = tx('Bitte gib den Ort an.');
    if (!form.vorname.trim()) next.vorname = tx('Bitte gib deinen Vornamen an.');
    if (!form.nachname.trim()) next.nachname = tx('Bitte gib deinen Nachnamen an.');
    if (!form.telefon.trim()) next.telefon = tx('Bitte gib eine Telefonnummer an.');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!cfg || !page) return;
    setSubmitting(true);
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
      setErrors({ problembeschreibung: tx('Es ist ein Fehler aufgetreten. Bitte versuche es erneut.') });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <PublicShell
        title={tx('Anfrage gesendet')}
        description={tx('Wir melden uns so schnell wie möglich bei dir.')}
      >
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground">{tx('Anfrage erfolgreich übermittelt')}</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            {tx('Vielen Dank! Deine Serviceanfrage ist bei uns eingegangen. Wir melden uns zeitnah bei dir.')}
          </p>
          <button
            type="button"
            onClick={() => { setForm(EMPTY_FORM); setErrors({}); setSubmitted(false); }}
            className="mt-2 text-sm text-primary underline underline-offset-4"
          >
            {tx('Weitere Anfrage stellen')}
          </button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      title={tx('Serviceanfrage')}
      description={tx('Schildere dein Problem – wir melden uns schnellstmöglich.')}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-8">

        {/* Section 1: Problem */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-2">
            {tx('Problem')}
          </h2>

          <div className="space-y-1">
            <label htmlFor="problembeschreibung" className="block text-sm font-medium text-foreground">
              {tx('Problembeschreibung')} <span className="text-destructive" aria-hidden>*</span>
            </label>
            <textarea
              id="problembeschreibung"
              value={form.problembeschreibung}
              onChange={set('problembeschreibung')}
              rows={4}
              placeholder={tx('Was ist passiert? Beschreibe das Problem so genau wie möglich.')}
              className={`w-full rounded-md border px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none ${errors.problembeschreibung ? 'border-destructive' : 'border-input'}`}
              aria-describedby={errors.problembeschreibung ? 'err-beschreibung' : undefined}
            />
            {errors.problembeschreibung && (
              <p id="err-beschreibung" className="text-xs text-destructive">{errors.problembeschreibung}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="block text-sm font-medium text-foreground">
              {tx('Dringlichkeit')} <span className="text-destructive" aria-hidden>*</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DRINGLICHKEIT_OPTIONS.map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                    form.dringlichkeit === opt.key
                      ? 'border-primary bg-primary/5'
                      : 'border-input hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="dringlichkeit"
                    value={opt.key}
                    checked={form.dringlichkeit === opt.key}
                    onChange={set('dringlichkeit')}
                    className="mt-0.5 shrink-0 accent-primary"
                  />
                  <span className="text-sm text-foreground leading-snug">{opt.label}</span>
                </label>
              ))}
            </div>
            {errors.dringlichkeit && (
              <p className="text-xs text-destructive">{errors.dringlichkeit}</p>
            )}
          </div>
        </section>

        {/* Section 2: Einsatzort */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-2">
            {tx('Einsatzort')}
          </h2>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <label htmlFor="strasse" className="block text-sm font-medium text-foreground">
                {tx('Straße')} <span className="text-destructive" aria-hidden>*</span>
              </label>
              <input
                id="strasse"
                type="text"
                value={form.strasse}
                onChange={set('strasse')}
                placeholder={tx('Musterstraße')}
                className={`w-full rounded-md border px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.strasse ? 'border-destructive' : 'border-input'}`}
              />
              {errors.strasse && <p className="text-xs text-destructive">{errors.strasse}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="hausnummer" className="block text-sm font-medium text-foreground">
                {tx('Nr.')} <span className="text-destructive" aria-hidden>*</span>
              </label>
              <input
                id="hausnummer"
                type="text"
                value={form.hausnummer}
                onChange={set('hausnummer')}
                placeholder={tx('12a')}
                className={`w-full rounded-md border px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.hausnummer ? 'border-destructive' : 'border-input'}`}
              />
              {errors.hausnummer && <p className="text-xs text-destructive">{errors.hausnummer}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="plz" className="block text-sm font-medium text-foreground">
                {tx('PLZ')} <span className="text-destructive" aria-hidden>*</span>
              </label>
              <input
                id="plz"
                type="text"
                value={form.plz}
                onChange={set('plz')}
                placeholder={tx('12345')}
                inputMode="numeric"
                className={`w-full rounded-md border px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.plz ? 'border-destructive' : 'border-input'}`}
              />
              {errors.plz && <p className="text-xs text-destructive">{errors.plz}</p>}
            </div>
            <div className="col-span-2 space-y-1">
              <label htmlFor="ort" className="block text-sm font-medium text-foreground">
                {tx('Stadt / Ort')} <span className="text-destructive" aria-hidden>*</span>
              </label>
              <input
                id="ort"
                type="text"
                value={form.ort}
                onChange={set('ort')}
                placeholder={tx('Musterstadt')}
                className={`w-full rounded-md border px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.ort ? 'border-destructive' : 'border-input'}`}
              />
              {errors.ort && <p className="text-xs text-destructive">{errors.ort}</p>}
            </div>
          </div>
        </section>

        {/* Section 3: Kontakt */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-2">
            {tx('Kontakt')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="vorname" className="block text-sm font-medium text-foreground">
                {tx('Vorname')} <span className="text-destructive" aria-hidden>*</span>
              </label>
              <input
                id="vorname"
                type="text"
                value={form.vorname}
                onChange={set('vorname')}
                placeholder={tx('Max')}
                autoComplete="given-name"
                className={`w-full rounded-md border px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.vorname ? 'border-destructive' : 'border-input'}`}
              />
              {errors.vorname && <p className="text-xs text-destructive">{errors.vorname}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor="nachname" className="block text-sm font-medium text-foreground">
                {tx('Nachname')} <span className="text-destructive" aria-hidden>*</span>
              </label>
              <input
                id="nachname"
                type="text"
                value={form.nachname}
                onChange={set('nachname')}
                placeholder={tx('Mustermann')}
                autoComplete="family-name"
                className={`w-full rounded-md border px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.nachname ? 'border-destructive' : 'border-input'}`}
              />
              {errors.nachname && <p className="text-xs text-destructive">{errors.nachname}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="telefon" className="block text-sm font-medium text-foreground">
              {tx('Telefonnummer')} <span className="text-destructive" aria-hidden>*</span>
            </label>
            <input
              id="telefon"
              type="tel"
              value={form.telefon}
              onChange={set('telefon')}
              placeholder={tx('+49 123 456789')}
              autoComplete="tel"
              className={`w-full rounded-md border px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${errors.telefon ? 'border-destructive' : 'border-input'}`}
            />
            {errors.telefon && <p className="text-xs text-destructive">{errors.telefon}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              {tx('E-Mail-Adresse')}
              <span className="ml-1 text-xs text-muted-foreground">{tx('(optional)')}</span>
            </label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder={tx('max@beispiel.de')}
              autoComplete="email"
              className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="erreichbarkeit" className="block text-sm font-medium text-foreground">
              {tx('Beste Erreichbarkeit')}
              <span className="ml-1 text-xs text-muted-foreground">{tx('(optional)')}</span>
            </label>
            <input
              id="erreichbarkeit"
              type="text"
              value={form.erreichbarkeit}
              onChange={set('erreichbarkeit')}
              placeholder={tx('z.B. Montag bis Freitag, 8–18 Uhr')}
              className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </section>

        {/* Required note */}
        <p className="text-xs text-muted-foreground">
          <span className="text-destructive">*</span> {tx('Pflichtfelder')}
        </p>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? tx('Wird gesendet…') : tx('Anfrage absenden')}
        </button>
      </form>
    </PublicShell>
  );
}
