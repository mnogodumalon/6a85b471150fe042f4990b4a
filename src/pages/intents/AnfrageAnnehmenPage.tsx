/**
 * Anfrage annehmen — 3-Schritt-Wizard.
 * Steps: 1) Problem erfassen (problembeschreibung + dringlichkeit)
 *        → 2) Einsatzort erfassen (strasse, hausnummer, plz, ort)
 *        → 3) Kontakt erfassen (vorname, nachname, telefon, email, erreichbarkeit)
 *           + Speichern: createServiceanfrageEntry() dann createAuftragsverwaltungEntry().
 * Reads: — (keine Entitäten vorab nötig).
 * Writes: serviceanfragen (createServiceanfrageEntry),
 *         auftragsverwaltung (createAuftragsverwaltungEntry).
 * Composes: IntentWizardShell.
 */
import React, { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { tx } from '@/i18n';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import {
  IconAlertTriangle,
  IconMapPin,
  IconUser,
  IconCheck,
  IconBolt,
} from '@tabler/icons-react';

const DRINGLICHKEIT_OPTIONS = LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? [];

export default function AnfrageAnnehmenPage() {
  const [step, setStep] = useState(1);

  // Schritt 1 – Problem
  const [problembeschreibung, setProblembeschreibung] = useState('');
  const [dringlichkeit, setDringlichkeit] = useState(DRINGLICHKEIT_OPTIONS[1]?.key ?? 'normal');

  // Schritt 2 – Einsatzort
  const [strasse, setStrasse] = useState('');
  const [hausnummer, setHausnummer] = useState('');
  const [plz, setPlz] = useState('');
  const [ort, setOrt] = useState('');

  // Schritt 3 – Kontakt
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [telefon, setTelefon] = useState('');
  const [email, setEmail] = useState('');
  const [erreichbarkeit, setErreichbarkeit] = useState('');

  // Abschluss
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdAnfrageId, setCreatedAnfrageId] = useState<string | null>(null);
  const [createdAuftragId, setCreatedAuftragId] = useState<string | null>(null);

  const STEPS = [
    { label: tx('Problem') },
    { label: tx('Einsatzort') },
    { label: tx('Kontakt') },
    { label: tx('Fertig') },
  ];

  const dringlichkeitConfig: Record<string, { color: string; icon: React.ReactElement; description: string }> = {
    nicht_dringend: {
      color: 'bg-secondary border-border text-foreground',
      icon: <IconCheck size={18} className="shrink-0 text-muted-foreground" />,
      description: tx('Kann warten'),
    },
    normal: {
      color: 'bg-secondary border-border text-foreground',
      icon: <IconAlertTriangle size={18} className="shrink-0 text-amber-500" />,
      description: tx('Innerhalb der nächsten Tage'),
    },
    dringend: {
      color: 'bg-secondary border-border text-foreground',
      icon: <IconAlertTriangle size={18} className="shrink-0 text-orange-500" />,
      description: tx('So bald wie möglich'),
    },
    notfall: {
      color: 'bg-destructive/10 border-destructive/30 text-foreground',
      icon: <IconBolt size={18} className="shrink-0 text-destructive" />,
      description: tx('Sofortiger Einsatz nötig'),
    },
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let anfrageId = createdAnfrageId;
      if (!anfrageId) {
        const anfrage = await LivingAppsService.createServiceanfrageEntry({
          problembeschreibung,
          dringlichkeit,
          strasse: strasse || undefined,
          hausnummer: hausnummer || undefined,
          plz: plz || undefined,
          ort: ort || undefined,
          vorname: vorname || undefined,
          nachname: nachname || undefined,
          telefon: telefon || undefined,
          email: email || undefined,
          erreichbarkeit: erreichbarkeit || undefined,
        });
        anfrageId = anfrage.record_id;
        setCreatedAnfrageId(anfrageId);
      }

      let auftragId = createdAuftragId;
      if (!auftragId) {
        const auftrag = await LivingAppsService.createAuftragsverwaltungEntry({
          anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, anfrageId),
        });
        auftragId = auftrag.record_id;
        setCreatedAuftragId(auftragId);
      }

      setStep(4);
    } catch {
      setSubmitError(tx('Speichern fehlgeschlagen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setProblembeschreibung('');
    setDringlichkeit(DRINGLICHKEIT_OPTIONS[1]?.key ?? 'normal');
    setStrasse('');
    setHausnummer('');
    setPlz('');
    setOrt('');
    setVorname('');
    setNachname('');
    setTelefon('');
    setEmail('');
    setErreichbarkeit('');
    setSubmitError(null);
    setCreatedAnfrageId(null);
    setCreatedAuftragId(null);
  };

  const step1Valid = problembeschreibung.trim().length > 0 && dringlichkeit.length > 0;
  const step2Valid = strasse.trim().length > 0 && hausnummer.trim().length > 0 && plz.trim().length > 0 && ort.trim().length > 0;
  const step3Valid = vorname.trim().length > 0 && nachname.trim().length > 0 && telefon.trim().length > 0;

  return (
    <IntentWizardShell
      title={tx('Neue Serviceanfrage')}
      subtitle={tx('Erfasse Telefon- und Walk-in-Anfragen Schritt für Schritt')}
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
    >
      {/* ── Schritt 1: Problem ──────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b">
            <IconAlertTriangle size={20} className="shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">{tx('Problem beschreiben')}</h2>
              <p className="text-sm text-muted-foreground">{tx('Was ist das Problem? Wie dringend ist es?')}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="problembeschreibung">
              {tx('Problembeschreibung')}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Textarea
              id="problembeschreibung"
              value={problembeschreibung}
              onChange={e => setProblembeschreibung(e.target.value)}
              placeholder={tx('Was genau ist das Problem? Bitte möglichst detailliert beschreiben …')}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>
              {tx('Dringlichkeit')}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DRINGLICHKEIT_OPTIONS.map(opt => {
                const cfg = dringlichkeitConfig[opt.key] ?? {
                  color: 'bg-secondary border-border text-foreground',
                  icon: <IconCheck size={18} className="shrink-0" />,
                  description: '',
                };
                const isSelected = dringlichkeit === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDringlichkeit(opt.key)}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : `border-transparent ${cfg.color} hover:border-primary/40`
                    }`}
                  >
                    {cfg.icon}
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{cfg.description}</div>
                    </div>
                    {isSelected && (
                      <IconCheck size={16} className="shrink-0 text-primary ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              disabled={!step1Valid}
              onClick={() => setStep(2)}
            >
              {tx('Weiter: Einsatzort')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Schritt 2: Einsatzort ───────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b">
            <IconMapPin size={20} className="shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">{tx('Einsatzort')}</h2>
              <p className="text-sm text-muted-foreground">{tx('Wo soll der Elektriker eingesetzt werden?')}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="strasse">
                {tx('Straße')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="strasse"
                value={strasse}
                onChange={e => setStrasse(e.target.value)}
                placeholder={tx('Musterstraße')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hausnummer">
                {tx('Nr.')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="hausnummer"
                value={hausnummer}
                onChange={e => setHausnummer(e.target.value)}
                placeholder="12a"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="plz">
                {tx('PLZ')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="plz"
                value={plz}
                onChange={e => setPlz(e.target.value)}
                placeholder="12345"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ort">
                {tx('Ort')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="ort"
                value={ort}
                onChange={e => setOrt(e.target.value)}
                placeholder={tx('Stadt')}
              />
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Zurück')}
            </Button>
            <Button
              disabled={!step2Valid}
              onClick={() => setStep(3)}
            >
              {tx('Weiter: Kontakt')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Schritt 3: Kontakt ──────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-2 border-b">
            <IconUser size={20} className="shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">{tx('Kontaktdaten')}</h2>
              <p className="text-sm text-muted-foreground">{tx('Wer hat die Anfrage gestellt?')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="vorname">
                {tx('Vorname')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="vorname"
                value={vorname}
                onChange={e => setVorname(e.target.value)}
                placeholder={tx('Max')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nachname">
                {tx('Nachname')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="nachname"
                value={nachname}
                onChange={e => setNachname(e.target.value)}
                placeholder={tx('Mustermann')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefon">
              {tx('Telefon')}
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Input
              id="telefon"
              type="tel"
              value={telefon}
              onChange={e => setTelefon(e.target.value)}
              placeholder="+49 123 456789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{tx('E-Mail')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={tx('max@beispiel.de')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="erreichbarkeit">{tx('Erreichbarkeit')}</Label>
            <Input
              id="erreichbarkeit"
              value={erreichbarkeit}
              onChange={e => setErreichbarkeit(e.target.value)}
              placeholder={tx('z. B. Montag bis Freitag, 8–18 Uhr')}
            />
          </div>

          {/* Zusammenfassung */}
          <div className="rounded-xl bg-secondary p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tx('Zusammenfassung')}</p>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">{tx('Problem:')}</span>{' '}
                <span className="line-clamp-2">{problembeschreibung}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{tx('Dringlichkeit:')}</span>{' '}
                <span>{DRINGLICHKEIT_OPTIONS.find(o => o.key === dringlichkeit)?.label ?? dringlichkeit}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{tx('Einsatzort:')}</span>{' '}
                <span>{strasse} {hausnummer}, {plz} {ort}</span>
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)} disabled={submitting}>
              {tx('Zurück')}
            </Button>
            <Button
              disabled={!step3Valid || submitting}
              onClick={handleSubmit}
            >
              {submitting ? tx('Wird gespeichert …') : tx('Anfrage & Auftrag anlegen')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Schritt 4: Fertig ───────────────────────────────── */}
      {step === 4 && (
        <div className="text-center py-10 space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-emerald-100 p-5">
              <IconCheck size={40} className="text-emerald-600" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{tx('Anfrage erfasst!')}</h2>
            <p className="text-muted-foreground text-sm">
              {tx('Die Serviceanfrage und der verknüpfte Auftrag wurden erfolgreich angelegt.')}
            </p>
          </div>

          <div className="rounded-xl bg-secondary p-4 text-left space-y-2 max-w-sm mx-auto">
            <div className="text-sm space-y-1">
              <div>
                <span className="text-muted-foreground">{tx('Kunde:')}</span>{' '}
                <span className="font-medium">{vorname} {nachname}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{tx('Dringlichkeit:')}</span>{' '}
                <span>{DRINGLICHKEIT_OPTIONS.find(o => o.key === dringlichkeit)?.label ?? dringlichkeit}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{tx('Einsatzort:')}</span>{' '}
                <span>{strasse} {hausnummer}, {plz} {ort}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button onClick={handleReset}>
              {tx('Neue Anfrage erfassen')}
            </Button>
            <Button variant="outline" asChild>
              <a href="#/">{tx('Zurück zum Dashboard')}</a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
