/**
 * Anfrage abschliessen — 3-Schritt-Wizard.
 * Steps: 1) Serviceanfrage wählen → 2) Auftrag anlegen → 3) Bestätigung.
 * Reads: serviceanfrage, auftragsverwaltung.
 * Writes: auftragsverwaltung (createAuftragsverwaltungEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge, getStatusColor.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconClipboardCheck, IconCircleCheck } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS, APP_IDS } from '@/types/app';
import type { Serviceanfrage } from '@/types/app';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

const DRINGLICHKEIT = LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? [];

export default function AnfrageAbschliessenPage() {
  const data = useDashboardData();
  const { serviceanfrage, auftragsverwaltung, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Serviceanfrage | null>(null);

  // Step 2 form state
  const [notizen, setNotizen] = useState('');
  const [erledigt, setErledigt] = useState(false);
  const [erledigungsdatum, setErledigungsdatum] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 3 state — idempotency guard
  const [createdAuftragId, setCreatedAuftragId] = useState<string | null>(null);

  // Filter: Serviceanfragen ohne verknüpften Auftrag
  const verknuepfteAnfrageUrls = new Set(
    auftragsverwaltung
      .map(a => a.fields.anfrage)
      .filter(Boolean) as string[]
  );

  const offeneAnfragen = serviceanfrage.filter(a => {
    const url = createRecordUrl(APP_IDS.SERVICEANFRAGE, a.record_id);
    return !verknuepfteAnfrageUrls.has(url);
  });

  const handleAnfrageSelect = (id: string) => {
    const found = serviceanfrage.find(a => a.record_id === id);
    if (found) {
      setSelectedAnfrage(found);
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let aid = createdAuftragId;
      if (!aid) {
        const auftrag = await LivingAppsService.createAuftragsverwaltungEntry({
          anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, selectedAnfrage.record_id),
          notizen: notizen || undefined,
          erledigt,
          erledigungsdatum: erledigt && erledigungsdatum ? erledigungsdatum : undefined,
        });
        aid = auftrag.record_id;
        setCreatedAuftragId(aid);
      }
      await fetchAll();
      setStep(3);
    } catch {
      setSubmitError(tx('Fehler beim Anlegen des Auftrags. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedAnfrage(null);
    setNotizen('');
    setErledigt(false);
    setErledigungsdatum('');
    setSubmitting(false);
    setSubmitError(null);
    setCreatedAuftragId(null);
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <IntentWizardShell
      title={tx('Anfrage abschließen')}
      subtitle={tx('Serviceanfrage als Auftrag erfassen und abschließen')}
      steps={[
        { label: tx('Anfrage') },
        { label: tx('Auftrag') },
        { label: tx('Fertig') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Serviceanfrage wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map(a => {
            const name = [a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
            const dringKey = a.fields.dringlichkeit?.key;
            const dringLabel = a.fields.dringlichkeit?.label;
            return {
              id: a.record_id,
              title: name,
              subtitle: [a.fields.ort, a.fields.problembeschreibung?.slice(0, 80)]
                .filter(Boolean)
                .join(' · '),
              status: dringKey ? { key: dringKey, label: dringLabel ?? dringKey } : undefined,
              icon: <IconClipboardCheck size={20} className="text-primary" />,
            };
          })}
          onSelect={handleAnfrageSelect}
          searchPlaceholder={tx('Anfrage suchen …')}
          emptyText={tx('Keine offenen Serviceanfragen ohne Auftrag gefunden.')}
        />
      )}

      {/* Step 2: Auftrag anlegen */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Ausgewählte Anfrage: Zusammenfassung */}
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {tx('Ausgewählte Anfrage')}
              </p>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {[selectedAnfrage.fields.vorname, selectedAnfrage.fields.nachname]
                      .filter(Boolean)
                      .join(' ') || tx('Unbekannt')}
                  </p>
                  {selectedAnfrage.fields.ort && (
                    <p className="text-sm text-muted-foreground">{selectedAnfrage.fields.ort}</p>
                  )}
                  {selectedAnfrage.fields.problembeschreibung && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {selectedAnfrage.fields.problembeschreibung}
                    </p>
                  )}
                </div>
                {selectedAnfrage.fields.dringlichkeit && (
                  <StatusBadge
                    statusKey={selectedAnfrage.fields.dringlichkeit.key}
                    label={selectedAnfrage.fields.dringlichkeit.label}
                  />
                )}
              </div>
            </div>

            {/* Auftrag Mini-Form */}
            <div className="rounded-2xl border bg-card p-4 space-y-5">
              <p className="font-semibold text-foreground">{tx('Auftragsdetails')}</p>

              {/* Notizen */}
              <div className="space-y-1.5">
                <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
                <Textarea
                  id="notizen"
                  value={notizen}
                  onChange={e => setNotizen(e.target.value)}
                  placeholder={tx('Optionale Hinweise für das Team …')}
                  rows={3}
                />
              </div>

              {/* Erledigt Checkbox */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="erledigt"
                  checked={erledigt}
                  onCheckedChange={v => {
                    setErledigt(!!v);
                    if (!v) setErledigungsdatum('');
                  }}
                />
                <Label htmlFor="erledigt" className="cursor-pointer">
                  {tx('Bereits erledigt?')}
                </Label>
              </div>

              {/* Erledigungsdatum — nur wenn erledigt */}
              {erledigt && (
                <div className="space-y-1.5">
                  <Label htmlFor="erledigungsdatum">{tx('Erledigungsdatum')}</Label>
                  <Input
                    id="erledigungsdatum"
                    type="date"
                    value={erledigungsdatum}
                    max={today}
                    onChange={e => setErledigungsdatum(e.target.value)}
                  />
                </div>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <div className="flex gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 sm:flex-none"
              >
                {submitting ? tx('Wird angelegt …') : tx('Auftrag anlegen')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* Step 3: Bestätigung */}
      {step === 3 && (
        createdAuftragId ? (
          <div className="flex flex-col items-center text-center gap-6 py-8">
            <IconCircleCheck size={56} className="text-emerald-500" stroke={1.5} />
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                {tx('Auftrag erfolgreich angelegt')}
              </h2>
              {selectedAnfrage && (
                <p className="text-sm text-muted-foreground">
                  {tx('Die Serviceanfrage von')}{' '}
                  <span className="font-medium text-foreground">
                    {[selectedAnfrage.fields.vorname, selectedAnfrage.fields.nachname]
                      .filter(Boolean)
                      .join(' ') || tx('Unbekannt')}
                  </span>{' '}
                  {erledigt ? tx('wurde als erledigt markiert.') : tx('wurde als Auftrag erfasst.')}
                </p>
              )}
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={handleReset}>
                {tx('Weitere Anfrage abschließen')}
              </Button>
              <a href="#/">
                <Button variant="outline">{tx('Zurück zum Dashboard')}</Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
