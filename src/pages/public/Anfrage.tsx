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
import { IconAlertTriangle, IconMapPin, IconPhone, IconCheck } from '@tabler/icons-react';

// ─── Typen ───────────────────────────────────────────────────────────────────

interface FormData {
  // Schritt 1
  problembeschreibung: string;
  dringlichkeit: string;
  // Schritt 2
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  // Schritt 3
  vorname: string;
  nachname: string;
  telefon: string;
  email: string;
  erreichbarkeit: string;
}

const TONE_MAP: Record<string, string> = {
  nicht_dringend: 'bg-slate-100 border-slate-300 text-slate-700',
  normal:         'bg-sky-50 border-sky-300 text-sky-700',
  dringend:       'bg-amber-50 border-amber-400 text-amber-800',
  notfall:        'bg-red-50 border-red-400 text-red-800',
};
const TONE_SELECTED: Record<string, string> = {
  nicht_dringend: 'ring-2 ring-slate-500',
  normal:         'ring-2 ring-sky-500',
  dringend:       'ring-2 ring-amber-500',
  notfall:        'ring-2 ring-red-500',
};

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function Anfrage() {
  const DRINGLICHKEIT_OPTIONS: { key: string; label: string; sublabel: string }[] = [
  { key: 'nicht_dringend', label: tx('Nicht dringend'), sublabel: tx('Kann warten') },
  { key: 'normal', label: tx('Normal'), sublabel: tx('Innerhalb der nächsten Tage') },
  { key: 'dringend', label: tx('Dringend'), sublabel: tx('So bald wie möglich') },
  { key: 'notfall', label: tx('Notfall'), sublabel: tx('Sofortiger Einsatz nötig') },
];

  const [cfg, setCfg]       = useState<PublicPagesConfig | null>(null);
  const [page, setPage]     = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep]       = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

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

  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPublicPagesConfig('anfrage')
      .then(c => {
        setCfg(c);
        setPage(c?.pages['anfrage'] ?? null);
        setLoading(false);
        if (!c?.pages['anfrage']) setUnavailable(true);
      })
      .catch(err => {
        setLoading(false);
        if (err instanceof PageUnavailableError) setUnavailable(true);
        else setUnavailable(true);
      });
  }, []);

  // Challenge warm-up on first interaction
  const challengePrepared = useRef(false);
  function warmUp() {
    if (challengePrepared.current || !cfg || !page) return;
    challengePrepared.current = true;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep) prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  }

  if (loading) return <PublicShell loading />;
  if (unavailable || !cfg || !page) return <PublicShell unavailable />;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function goNext() {
    setStep(s => s + 1);
    scrollTop();
  }
  function goBack() {
    setStep(s => s - 1);
    setError(null);
    scrollTop();
  }

  // ── Validierungen ─────────────────────────────────────────────────────────

  function step1Valid() {
    return form.problembeschreibung.trim().length > 0 && form.dringlichkeit !== '';
  }
  function step2Valid() {
    return (
      form.strasse.trim() !== '' &&
      form.hausnummer.trim() !== '' &&
      form.plz.trim() !== '' &&
      form.ort.trim() !== ''
    );
  }
  function step3Valid() {
    return (
      form.vorname.trim() !== '' &&
      form.nachname.trim() !== '' &&
      form.telefon.trim() !== ''
    );
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!step3Valid() || !cfg || !page) return;
    setSubmitting(true);
    setError(null);
    try {
      const fields: Record<string, string> = {
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
      if (form.email.trim())        fields.email        = form.email.trim();
      if (form.erreichbarkeit.trim()) fields.erreichbarkeit = form.erreichbarkeit.trim();

      await createPublicRecord(cfg, page, fields);
      setSubmitted(true);
      scrollTop();
    } catch {
      setError(tx('Etwas ist schiefgelaufen. Bitte versuche es noch einmal.'));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Bestätigung ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <PublicShell>
        <div ref={topRef} className="max-w-lg mx-auto px-4 py-12 text-center">
          <div className="mx-auto mb-5 flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
            <IconCheck size={32} className="text-emerald-600" stroke={2} />
          </div>
          <h1 className="text-2xl font-semibold mb-3">{tx('Anfrage eingegangen!')}</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            {tx('Ihre Anfrage ist angekommen — ich melde mich so schnell wie möglich.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  // ─── Landing + Formular ───────────────────────────────────────────────────

  return (
    <PublicShell wide>
      <div ref={topRef} className="max-w-xl mx-auto px-4 pb-10">

        {/* Landing-Header */}
        {step === 1 && (
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold mb-2">{tx('Anfrage stellen')}</h1>
            <p className="text-muted-foreground text-base">
              {tx('Ich helfe schnell und zuverlässig — beschreibe kurz das Problem.')}
            </p>
          </div>
        )}

        {/* Schritt-Indikator */}
        <StepIndicator current={step} total={3} />

        {/* ─── Schritt 1: Problem beschreiben ─────────────────────────────── */}
        {step === 1 && (
          <form
            onFocus={warmUp}
            onSubmit={e => { e.preventDefault(); if (step1Valid()) goNext(); }}
            className="space-y-6 mt-6"
          >
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {tx('Was ist das Problem?')}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <textarea
                value={form.problembeschreibung}
                onChange={e => set('problembeschreibung', e.target.value)}
                placeholder={tx('Z. B. Steckdose defekt im Wohnzimmer, Sicherung fliegt raus …')}
                rows={4}
                required
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {tx('Wie dringend ist es?')}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DRINGLICHKEIT_OPTIONS.map(opt => {
                  const selected = form.dringlichkeit === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => set('dringlichkeit', opt.key)}
                      className={[
                        'text-left rounded-xl border px-4 py-3 transition-all',
                        TONE_MAP[opt.key],
                        selected ? TONE_SELECTED[opt.key] : 'opacity-80 hover:opacity-100',
                      ].join(' ')}
                    >
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs mt-0.5 opacity-75">{opt.sublabel}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={!step1Valid()}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium disabled:opacity-40 transition-opacity"
            >
              {tx('Weiter zur Adresse')}
            </button>
          </form>
        )}

        {/* ─── Schritt 2: Adresse eingeben ─────────────────────────────────── */}
        {step === 2 && (
          <form
            onFocus={warmUp}
            onSubmit={e => { e.preventDefault(); if (step2Valid()) goNext(); }}
            className="space-y-5 mt-6"
          >
            <SectionHeader
              icon={<IconMapPin size={16} className="shrink-0" />}
              title={tx('Einsatzadresse')}
            />

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <FieldLabel label={tx('Straße')} required />
                <input
                  type="text"
                  value={form.strasse}
                  onChange={e => set('strasse', e.target.value)}
                  placeholder={tx('Musterstraße')}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel label={tx('Nr.')} required />
                <input
                  type="text"
                  value={form.hausnummer}
                  onChange={e => set('hausnummer', e.target.value)}
                  placeholder="12a"
                  required
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <FieldLabel label={tx('PLZ')} required />
                <input
                  type="text"
                  value={form.plz}
                  onChange={e => set('plz', e.target.value)}
                  placeholder="12345"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <FieldLabel label={tx('Ort')} required />
                <input
                  type="text"
                  value={form.ort}
                  onChange={e => set('ort', e.target.value)}
                  placeholder={tx('Musterstadt')}
                  required
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={goBack} className={backBtnCls}>
                {tx('Zurück')}
              </button>
              <button
                type="submit"
                disabled={!step2Valid()}
                className="flex-1 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium disabled:opacity-40 transition-opacity"
              >
                {tx('Weiter zu Kontaktdaten')}
              </button>
            </div>
          </form>
        )}

        {/* ─── Schritt 3: Kontakt angeben ──────────────────────────────────── */}
        {step === 3 && (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 mt-6"
          >
            <SectionHeader
              icon={<IconPhone size={16} className="shrink-0" />}
              title={tx('Kontaktdaten')}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel label={tx('Vorname')} required />
                <input
                  type="text"
                  value={form.vorname}
                  onChange={e => set('vorname', e.target.value)}
                  placeholder={tx('Max')}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel label={tx('Nachname')} required />
                <input
                  type="text"
                  value={form.nachname}
                  onChange={e => set('nachname', e.target.value)}
                  placeholder={tx('Mustermann')}
                  required
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <FieldLabel label={tx('Telefonnummer')} required />
              <input
                type="tel"
                value={form.telefon}
                onChange={e => set('telefon', e.target.value)}
                placeholder="+49 123 456789"
                required
                className={inputCls}
              />
            </div>

            <div>
              <FieldLabel label={tx('E-Mail-Adresse')} />
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder={tx('max@beispiel.de')}
                className={inputCls}
              />
            </div>

            <div>
              <FieldLabel label={tx('Beste Erreichbarkeit')} />
              <input
                type="text"
                value={form.erreichbarkeit}
                onChange={e => set('erreichbarkeit', e.target.value)}
                placeholder={tx('Z. B. Montag–Freitag 9–17 Uhr')}
                className={inputCls}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <IconAlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Zusammenfassung */}
            <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1">
              <div className="font-medium text-foreground text-sm mb-1">{tx('Zusammenfassung')}</div>
              <div><span className="font-medium">{tx('Problem:')}</span> {form.problembeschreibung.slice(0, 80)}{form.problembeschreibung.length > 80 ? '…' : ''}</div>
              <div><span className="font-medium">{tx('Adresse:')}</span> {form.strasse} {form.hausnummer}, {form.plz} {form.ort}</div>
              <div>
                <span className="font-medium">{tx('Dringlichkeit:')}</span>{' '}
                {DRINGLICHKEIT_OPTIONS.find(o => o.key === form.dringlichkeit)?.label ?? form.dringlichkeit}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={goBack} className={backBtnCls}>
                {tx('Zurück')}
              </button>
              <button
                type="submit"
                disabled={!step3Valid() || submitting}
                className="flex-1 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium disabled:opacity-40 transition-opacity"
              >
                {submitting ? tx('Wird gesendet …') : tx('Absenden')}
              </button>
            </div>
          </form>
        )}
      </div>
    </PublicShell>
  );
}

// ─── Hilfskomponenten ─────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

const backBtnCls =
  'rounded-xl border border-input bg-background px-5 py-3 text-sm font-medium hover:bg-muted transition-colors';

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-sm font-medium mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-base font-semibold text-foreground">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = [tx('Problem'), tx('Adresse'), tx('Kontakt')];
  return (
    <div className="flex items-center gap-0 justify-center">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
            <div className={[
              'flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold border-2 transition-all',
              done   ? 'bg-emerald-500 border-emerald-500 text-white' :
              active ? 'bg-primary border-primary text-primary-foreground' :
                       'bg-background border-input text-muted-foreground',
            ].join(' ')}>
              {done ? <IconCheck size={13} stroke={2.5} /> : n}
            </div>
            <span className={[
              'ml-1.5 text-xs font-medium',
              active ? 'text-foreground' : 'text-muted-foreground',
            ].join(' ')}>
              {labels[i]}
            </span>
            {n < total && (
              <div className={[
                'mx-3 h-px w-8',
                done ? 'bg-emerald-400' : 'bg-border',
              ].join(' ')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
