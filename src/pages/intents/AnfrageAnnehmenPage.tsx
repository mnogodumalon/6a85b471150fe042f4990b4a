/**
 * Anfrage annehmen — 2-Schritt-Wizard.
 * Steps: 1) Offene Serviceanfrage wählen (ohne verknüpften Auftrag) →
 *         2) Notizen erfassen & Auftrag anlegen (createAuftragsverwaltungEntry).
 * Reads: serviceanfrage, auftragsverwaltung. Writes: auftragsverwaltung (createAuftragsverwaltungEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Serviceanfrage } from '@/types/app';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { IconClipboardCheck, IconMapPin, IconPhone, IconUser, IconAlertTriangle } from '@tabler/icons-react';

export default function AnfrageAnnehmenPage() {
  const WIZARD_STEPS = [
  { label: tx('Anfrage wählen') },
  { label: tx('Auftrag anlegen') },
];

  const { serviceanfrage, auftragsverwaltung, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Serviceanfrage | null>(null);
  const [notizen, setNotizen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Serviceanfragen, die bereits einen Auftrag haben — anhand der anfrage-URL ausschließen
  const verknuepfteAnfrageIds = new Set(
    auftragsverwaltung.flatMap(av => {
      const id = extractRecordId(av.fields.anfrage);
      return id ? [id] : [];
    })
  );

  const offeneAnfragen = serviceanfrage.filter(
    sa => !verknuepfteAnfrageIds.has(sa.record_id)
  );

  const dringlichkeitOptions = LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? [];

  function getDringlichkeitLabel(key?: string) {
    if (!key) return null;
    return dringlichkeitOptions.find(o => o.key === key)?.label ?? key;
  }

  async function handleAuftragAnlegen() {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.createAuftragsverwaltungEntry({
        anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, selectedAnfrage.record_id),
        erledigt: false,
        notizen: notizen.trim() || undefined,
      });
      await fetchAll();
      setDone(true);
    } catch {
      setSubmitError(tx('Fehler beim Anlegen des Auftrags. Bitte nochmals versuchen.'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setSelectedAnfrage(null);
    setNotizen('');
    setSubmitError(null);
    setDone(false);
  }

  return (
    <IntentWizardShell
      title={tx('Anfrage annehmen')}
      subtitle={tx('Offene Serviceanfrage zu einem Auftrag umwandeln')}
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Schritt 1: Anfrage wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map(sa => {
            const adresse = [sa.fields.strasse, sa.fields.hausnummer, sa.fields.plz, sa.fields.ort]
              .filter(Boolean)
              .join(' ');
            const name = [sa.fields.vorname, sa.fields.nachname].filter(Boolean).join(' ');
            const dring = sa.fields.dringlichkeit;
            return {
              id: sa.record_id,
              title: sa.fields.problembeschreibung
                ? sa.fields.problembeschreibung.slice(0, 80)
                : tx('Keine Beschreibung'),
              subtitle: [name, adresse].filter(Boolean).join(' · '),
              status: dring ? { key: dring.key, label: dring.label } : undefined,
              icon: <IconClipboardCheck size={20} className="text-primary shrink-0" />,
            };
          })}
          onSelect={(id) => {
            const found = offeneAnfragen.find(sa => sa.record_id === id) ?? null;
            setSelectedAnfrage(found);
            setStep(2);
          }}
          searchPlaceholder={tx('Anfrage suchen …')}
          emptyText={tx('Alle Serviceanfragen haben bereits einen verknüpften Auftrag.')}
          emptyIcon={<IconAlertTriangle size={36} className="text-muted-foreground" />}
        />
      )}

      {/* Schritt 2: Auftrag anlegen */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6 max-w-xl mx-auto">
            {/* Zusammenfassung der gewählten Anfrage */}
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <IconClipboardCheck size={20} className="text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground line-clamp-2">
                    {selectedAnfrage.fields.problembeschreibung ?? tx('Keine Beschreibung')}
                  </p>
                  {selectedAnfrage.fields.dringlichkeit && (
                    <div className="mt-1">
                      <StatusBadge
                        statusKey={selectedAnfrage.fields.dringlichkeit.key}
                        label={getDringlichkeitLabel(selectedAnfrage.fields.dringlichkeit.key) ?? selectedAnfrage.fields.dringlichkeit.label}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                {(selectedAnfrage.fields.vorname || selectedAnfrage.fields.nachname) && (
                  <div className="flex items-center gap-1.5">
                    <IconUser size={14} className="shrink-0" />
                    <span className="truncate">
                      {[selectedAnfrage.fields.vorname, selectedAnfrage.fields.nachname].filter(Boolean).join(' ')}
                    </span>
                  </div>
                )}
                {selectedAnfrage.fields.telefon && (
                  <div className="flex items-center gap-1.5">
                    <IconPhone size={14} className="shrink-0" />
                    <span className="truncate">{selectedAnfrage.fields.telefon}</span>
                  </div>
                )}
                {(selectedAnfrage.fields.strasse || selectedAnfrage.fields.ort) && (
                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    <IconMapPin size={14} className="shrink-0" />
                    <span className="truncate">
                      {[
                        selectedAnfrage.fields.strasse,
                        selectedAnfrage.fields.hausnummer,
                        selectedAnfrage.fields.plz,
                        selectedAnfrage.fields.ort,
                      ].filter(Boolean).join(' ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mini-Formular: Notizen */}
            <div className="space-y-2">
              <Label htmlFor="notizen">{tx('Notizen')}</Label>
              <Textarea
                id="notizen"
                value={notizen}
                onChange={e => setNotizen(e.target.value)}
                placeholder={tx('Optionale Hinweise zum Auftrag …')}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">{tx('Optional — kann später ergänzt werden.')}</p>
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                {tx('Zurück')}
              </Button>
              <Button onClick={handleAuftragAnlegen} disabled={submitting}>
                {submitting ? tx('Wird angelegt …') : tx('Auftrag anlegen')}
              </Button>
            </div>
          </div>
        ) : (
          /* Kein Auftrag ausgewählt — z.B. Direktlink auf ?step=2 */
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

      {/* Erfolgszustand */}
      {done && (
        <div className="text-center py-12 space-y-4">
          <div className="flex justify-center">
            <IconClipboardCheck size={48} className="text-primary" stroke={1.5} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{tx('Auftrag angelegt')}</h2>
            <p className="text-sm text-muted-foreground">
              {tx('Die Serviceanfrage wurde erfolgreich in einen Auftrag umgewandelt.')}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={handleReset}>{tx('Weitere Anfrage annehmen')}</Button>
            <Button variant="outline" asChild>
              <a href="#/">{tx('Zurück zum Dashboard')}</a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
