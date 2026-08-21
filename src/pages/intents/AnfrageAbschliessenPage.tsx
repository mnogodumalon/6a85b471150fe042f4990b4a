/**
 * Anfrage abschliessen — 2-Schritt-Wizard.
 * Steps: 1) Serviceanfrage auswählen → 2) Auftrag anlegen oder bestehenden als erledigt markieren.
 * Reads: serviceanfrage, auftragsverwaltung.
 * Writes: auftragsverwaltung (createAuftragsverwaltungEntry, updateAuftragsverwaltungEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { IconCheck, IconClipboardList, IconAlertTriangle } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Serviceanfrage } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { tx } from '@/i18n';

export default function AnfrageAbschliessenPage() {
  const data = useDashboardData();
  const { serviceanfrage, auftragsverwaltung, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedAnfrageId, setSelectedAnfrageId] = useState<string | null>(null);
  const [notizen, setNotizen] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Dringlichkeit-Labels aus dem Schema (locale-aware, im Component Body)
  const DRINGLICHKEIT = LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? [];

  // Offene Serviceanfragen: alle anzeigen (Elektriker entscheidet selbst)
  const openAnfragen = useMemo(() => serviceanfrage, [serviceanfrage]);

  // Für die ausgewählte Anfrage: existierender Auftragsverwaltungs-Eintrag suchen
  const existingAuftrag = useMemo(() => {
    if (!selectedAnfrageId) return null;
    return auftragsverwaltung.find(av => {
      const linkedId = extractRecordId(av.fields.anfrage ?? '');
      return linkedId === selectedAnfrageId;
    }) ?? null;
  }, [selectedAnfrageId, auftragsverwaltung]);

  const selectedAnfrage = useMemo(
    () => serviceanfrage.find(a => a.record_id === selectedAnfrageId) ?? null,
    [selectedAnfrageId, serviceanfrage]
  );

  const dringlichkeitLabel = (key: string | undefined) =>
    DRINGLICHKEIT.find(o => o.key === key)?.label ?? key ?? '';

  const handleSelectAnfrage = (id: string) => {
    setSelectedAnfrageId(id);
    setNotizen('');
    setSaveError(null);
    setDone(false);
    setStep(2);
  };

  const handleAbschliessen = async () => {
    if (!selectedAnfrageId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      if (existingAuftrag) {
        await LivingAppsService.updateAuftragsverwaltungEntry(existingAuftrag.record_id, {
          erledigt: true,
          erledigungsdatum: today,
          notizen: notizen || undefined,
        });
      } else {
        await LivingAppsService.createAuftragsverwaltungEntry({
          anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, selectedAnfrageId),
          erledigt: true,
          erledigungsdatum: today,
          notizen: notizen || undefined,
        });
      }
      await fetchAll();
      setDone(true);
    } catch (e) {
      setSaveError(tx('Fehler beim Speichern. Bitte erneut versuchen.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedAnfrageId(null);
    setNotizen('');
    setSaveError(null);
    setDone(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage abschliessen')}
      subtitle={tx('Serviceanfrage prüfen und Auftrag als erledigt markieren')}
      steps={[{ label: tx('Anfrage wählen') }, { label: tx('Abschliessen') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Serviceanfrage auswählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={openAnfragen.map(a => ({
            id: a.record_id,
            title: [a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt'),
            subtitle: [
              a.fields.ort,
              a.fields.dringlichkeit?.label,
              a.fields.problembeschreibung
                ? a.fields.problembeschreibung.slice(0, 80) + (a.fields.problembeschreibung.length > 80 ? '…' : '')
                : undefined,
            ]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.dringlichkeit
              ? { key: a.fields.dringlichkeit.key, label: a.fields.dringlichkeit.label }
              : undefined,
            icon: <IconClipboardList size={20} className="text-primary shrink-0" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Anfrage suchen …')}
          emptyText={tx('Keine offenen Anfragen gefunden')}
          emptyIcon={<IconClipboardList size={48} className="text-muted-foreground" />}
        />
      )}

      {/* ── Schritt 2: Auftrag abschliessen ── */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6 max-w-xl mx-auto">
            {done ? (
              /* Erfolgszustand */
              <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-emerald-100 p-4">
                    <IconCheck size={40} className="text-emerald-600" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  {tx('Anfrage abgeschlossen')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {[selectedAnfrage.fields.vorname, selectedAnfrage.fields.nachname]
                    .filter(Boolean)
                    .join(' ')}{' '}
                  — {selectedAnfrage.fields.ort}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button onClick={handleReset} variant="outline">
                    {tx('Weitere Anfrage abschliessen')}
                  </Button>
                  <a href="#/">
                    <Button>{tx('Zurück zum Dashboard')}</Button>
                  </a>
                </div>
              </div>
            ) : (
              <>
                {/* Anfragedetails */}
                <div className="rounded-2xl border bg-card p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <IconClipboardList size={22} className="text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {[selectedAnfrage.fields.vorname, selectedAnfrage.fields.nachname]
                          .filter(Boolean)
                          .join(' ') || tx('Unbekannt')}
                      </p>
                      {selectedAnfrage.fields.ort && (
                        <p className="text-sm text-muted-foreground truncate">
                          {selectedAnfrage.fields.ort}
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedAnfrage.fields.dringlichkeit && (
                    <div className="flex items-center gap-2">
                      {selectedAnfrage.fields.dringlichkeit.key === 'notfall' ||
                      selectedAnfrage.fields.dringlichkeit.key === 'dringend' ? (
                        <IconAlertTriangle size={16} className="text-amber-600 shrink-0" />
                      ) : null}
                      <span className="text-sm font-medium">
                        {selectedAnfrage.fields.dringlichkeit.label}
                      </span>
                    </div>
                  )}

                  {selectedAnfrage.fields.problembeschreibung && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {selectedAnfrage.fields.problembeschreibung}
                    </p>
                  )}

                  {existingAuftrag && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                      {tx('Bestehender Auftrag wird aktualisiert')}
                    </div>
                  )}
                </div>

                {/* Mini-Formular: Abschluss */}
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <h3 className="font-semibold text-foreground">{tx('Abschlussdetails')}</h3>

                  {/* Erledigt — vorbelegt true, anzeigen als Info */}
                  <div className="flex items-center gap-2 text-sm">
                    <IconCheck size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-muted-foreground">{tx('Als erledigt markieren')}</span>
                    <span className="font-medium text-emerald-700">{tx('Ja')}</span>
                  </div>

                  {/* Erledigungsdatum — vorbelegt heutiges Datum */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Erledigungsdatum')}
                    </label>
                    <input
                      type="date"
                      defaultValue={format(new Date(), 'yyyy-MM-dd')}
                      readOnly
                      className="w-full rounded-lg border border-input bg-secondary px-3 py-2 text-sm text-muted-foreground"
                    />
                  </div>

                  {/* Notizen — optional */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Notizen')}{' '}
                      <span className="text-muted-foreground font-normal">({tx('optional')})</span>
                    </label>
                    <Textarea
                      value={notizen}
                      onChange={e => setNotizen(e.target.value)}
                      placeholder={tx('z. B. Defekte Steckdose ausgetauscht, Material vor Ort …')}
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {saveError && (
                    <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {saveError}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <Button
                      variant="outline"
                      onClick={() => setStep(1)}
                      disabled={saving}
                      className="sm:w-auto"
                    >
                      {tx('Zurück')}
                    </Button>
                    <Button
                      onClick={handleAbschliessen}
                      disabled={saving}
                      className="flex-1 sm:flex-none"
                    >
                      {saving
                        ? tx('Wird gespeichert …')
                        : existingAuftrag
                        ? tx('Auftrag als erledigt markieren')
                        : tx('Auftrag anlegen und abschliessen')}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Fallback: Anfrage nicht geladen (Deep-Link auf Schritt 2) */
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine Auswahl aus Schritt 1.')}
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
