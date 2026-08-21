/**
 * Anfrage abschließen — 3-Schritt-Wizard.
 * Steps: 1) Serviceanfrage wählen → 2) Details & Notizen erfassen → 3) Abschließen & bestätigen.
 * Reads: serviceanfrage, auftragsverwaltung.
 * Writes: auftragsverwaltung (createAuftragsverwaltungEntry / updateAuftragsverwaltungEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconCheck, IconAlertCircle, IconClipboardList } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Serviceanfrage } from '@/types/app';
import { lookupKey } from '@/lib/formatters';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const DRINGLICHKEIT_OPTIONS = LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? [];

function dringlichkeitLabel(key: string | undefined): string {
  if (!key) return '';
  return DRINGLICHKEIT_OPTIONS.find(o => o.key === key)?.label ?? key;
}

function dringlichkeitTone(key: string | undefined): 'default' | 'warning' | 'destructive' | 'success' {
  if (key === 'notfall') return 'destructive';
  if (key === 'dringend') return 'warning';
  if (key === 'normal') return 'default';
  return 'default';
}

export default function AnfrageAbschliessenPage() {
  const { serviceanfrage, auftragsverwaltung, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrageId, setSelectedAnfrageId] = useState<string | null>(null);
  const [notizen, setNotizen] = useState('');
  const [erledigungsdatum, setErledigungsdatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [erledigt, setErledigt] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Find the selected Serviceanfrage record
  const selectedAnfrage: Serviceanfrage | undefined = selectedAnfrageId
    ? serviceanfrage.find(s => s.record_id === selectedAnfrageId)
    : undefined;

  // Find existing Auftragsverwaltung entry for selected Anfrage
  const existingAuftrag = selectedAnfrageId
    ? auftragsverwaltung.find(a => {
        const linkedId = extractRecordId(a.fields.anfrage);
        return linkedId === selectedAnfrageId;
      })
    : undefined;

  const handleAnfrageSelect = (id: string) => {
    setSelectedAnfrageId(id);
    // Pre-fill notizen from existing Auftrag if available
    const existing = auftragsverwaltung.find(a => extractRecordId(a.fields.anfrage) === id);
    if (existing) {
      setNotizen(existing.fields.notizen ?? '');
      setErledigungsdatum(existing.fields.erledigungsdatum ?? format(new Date(), 'yyyy-MM-dd'));
      setErledigt(existing.fields.erledigt ?? true);
    } else {
      setNotizen('');
      setErledigungsdatum(format(new Date(), 'yyyy-MM-dd'));
      setErledigt(true);
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedAnfrageId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (existingAuftrag && !existingAuftrag.fields.erledigt) {
        await LivingAppsService.updateAuftragsverwaltungEntry(existingAuftrag.record_id, {
          erledigt,
          erledigungsdatum: erledigungsdatum || undefined,
          notizen: notizen || undefined,
        });
      } else if (!existingAuftrag) {
        await LivingAppsService.createAuftragsverwaltungEntry({
          anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, selectedAnfrageId),
          erledigt,
          erledigungsdatum: erledigungsdatum || undefined,
          notizen: notizen || undefined,
        });
      }
      await fetchAll();
      setDone(true);
      setStep(3);
    } catch (err) {
      setSubmitError(tx('Fehler beim Abschließen der Anfrage. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedAnfrageId(null);
    setNotizen('');
    setErledigungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setErledigt(true);
    setSubmitting(false);
    setSubmitError(null);
    setDone(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage abschließen')}
      subtitle={tx('Serviceanfrage prüfen, Notizen hinzufügen und als erledigt markieren')}
      steps={[
        { label: tx('Anfrage wählen') },
        { label: tx('Details & Notizen') },
        { label: tx('Abschließen') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Anfrage wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={serviceanfrage.map(s => {
            const dringKey = lookupKey(s.fields.dringlichkeit);
            const existsAndDone = auftragsverwaltung.find(
              a => extractRecordId(a.fields.anfrage) === s.record_id && a.fields.erledigt
            );
            return {
              id: s.record_id,
              title: [s.fields.vorname, s.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt'),
              subtitle: [s.fields.ort, s.fields.problembeschreibung].filter(Boolean).join(' · ') || undefined,
              status: s.fields.dringlichkeit
                ? { key: dringKey ?? '', label: dringlichkeitLabel(dringKey ?? undefined) }
                : undefined,
              stats: existsAndDone
                ? [{ label: tx('Status'), value: tx('Bereits erledigt') }]
                : undefined,
            };
          })}
          onSelect={handleAnfrageSelect}
          searchPlaceholder={tx('Name oder Ort suchen …')}
          emptyText={tx('Keine Serviceanfragen vorhanden')}
          emptyIcon={<IconClipboardList size={48} className="text-muted-foreground" />}
        />
      )}

      {/* ── Step 2: Details & Notizen ── */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Read-only summary */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-lg text-foreground">
                    {[selectedAnfrage.fields.vorname, selectedAnfrage.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt')}
                  </h2>
                  {selectedAnfrage.fields.dringlichkeit && (
                    <StatusBadge
                      statusKey={lookupKey(selectedAnfrage.fields.dringlichkeit) ?? undefined}
                      label={selectedAnfrage.fields.dringlichkeit.label}
                      className="mt-1"
                    />
                  )}
                </div>
              </div>

              {selectedAnfrage.fields.problembeschreibung && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{tx('Problembeschreibung')}</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {selectedAnfrage.fields.problembeschreibung}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(selectedAnfrage.fields.strasse || selectedAnfrage.fields.ort) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tx('Adresse')}</p>
                    <p className="text-sm text-foreground">
                      {[
                        selectedAnfrage.fields.strasse,
                        selectedAnfrage.fields.hausnummer,
                      ].filter(Boolean).join(' ')}
                      {(selectedAnfrage.fields.strasse || selectedAnfrage.fields.hausnummer) &&
                        (selectedAnfrage.fields.plz || selectedAnfrage.fields.ort) && ', '}
                      {[selectedAnfrage.fields.plz, selectedAnfrage.fields.ort].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}

                {selectedAnfrage.fields.telefon && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tx('Telefon')}</p>
                    <p className="text-sm text-foreground">{selectedAnfrage.fields.telefon}</p>
                  </div>
                )}

                {selectedAnfrage.fields.email && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tx('E-Mail')}</p>
                    <p className="text-sm text-foreground">{selectedAnfrage.fields.email}</p>
                  </div>
                )}

                {selectedAnfrage.fields.erreichbarkeit && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tx('Erreichbarkeit')}</p>
                    <p className="text-sm text-foreground">{selectedAnfrage.fields.erreichbarkeit}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Editable fields */}
            <div className="rounded-2xl border bg-card p-5 space-y-5">
              <h3 className="font-medium text-foreground">{tx('Auftragsdaten erfassen')}</h3>

              <div className="space-y-2">
                <Label htmlFor="erledigungsdatum">{tx('Erledigungsdatum')}</Label>
                <Input
                  id="erledigungsdatum"
                  type="date"
                  value={erledigungsdatum}
                  onChange={e => setErledigungsdatum(e.target.value)}
                  className="max-w-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notizen">{tx('Notizen')}</Label>
                <Textarea
                  id="notizen"
                  value={notizen}
                  onChange={e => setNotizen(e.target.value)}
                  placeholder={tx('Optionale Notizen zum Einsatz …')}
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="erledigt"
                  checked={erledigt}
                  onCheckedChange={v => setErledigt(v === true)}
                />
                <Label htmlFor="erledigt" className="cursor-pointer">
                  {tx('Als erledigt markieren')}
                </Label>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Zurück')}
              </Button>
              <Button onClick={() => setStep(3)}>
                {tx('Weiter zur Bestätigung')}
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

      {/* ── Step 3: Abschließen ── */}
      {step === 3 && (
        selectedAnfrage ? (
          done ? (
            /* Success state */
            <div className="max-w-lg mx-auto text-center py-12 space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-100 p-4">
                  <IconCheck size={48} className="text-emerald-600" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">
                  {tx('Anfrage erfolgreich abgeschlossen')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Die Serviceanfrage wurde als erledigt markiert und der Auftrag gespeichert.')}
                </p>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={handleReset}>
                  {tx('Weitere Anfrage abschließen')}
                </Button>
                <Button variant="outline" asChild>
                  <a href="#/">{tx('Zurück zum Dashboard')}</a>
                </Button>
              </div>
            </div>
          ) : (
            /* Confirmation step */
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h2 className="font-semibold text-foreground">{tx('Zusammenfassung')}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tx('Kunde')}</p>
                    <p className="text-sm font-medium text-foreground">
                      {[selectedAnfrage.fields.vorname, selectedAnfrage.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt')}
                    </p>
                  </div>

                  {selectedAnfrage.fields.dringlichkeit && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{tx('Dringlichkeit')}</p>
                      <StatusBadge
                        statusKey={lookupKey(selectedAnfrage.fields.dringlichkeit) ?? undefined}
                        label={selectedAnfrage.fields.dringlichkeit.label}
                      />
                    </div>
                  )}

                  {erledigungsdatum && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{tx('Erledigungsdatum')}</p>
                      <p className="text-sm text-foreground">{erledigungsdatum}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tx('Status')}</p>
                    <p className="text-sm text-foreground">
                      {erledigt ? tx('Als erledigt markiert') : tx('Nicht abgeschlossen')}
                    </p>
                  </div>
                </div>

                {notizen && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{tx('Notizen')}</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{notizen}</p>
                  </div>
                )}

                {existingAuftrag && !existingAuftrag.fields.erledigt && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <IconAlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      {tx('Vorhandener Auftrag wird aktualisiert (nicht als neuer Eintrag angelegt).')}
                    </p>
                  </div>
                )}
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                  <IconAlertCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{submitError}</p>
                </div>
              )}

              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" onClick={() => setStep(2)} disabled={submitting}>
                  {tx('Zurück')}
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? tx('Wird gespeichert …') : tx('Anfrage abschließen')}
                </Button>
              </div>
            </div>
          )
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
