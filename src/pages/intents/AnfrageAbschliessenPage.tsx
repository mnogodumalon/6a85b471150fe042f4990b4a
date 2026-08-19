/**
 * Anfrage abschliessen — 2-Schritt-Wizard.
 * Steps: 1) Offene Serviceanfrage wählen → 2) Auftrag anlegen/aktualisieren & als erledigt markieren.
 * Reads: serviceanfrage, auftragsverwaltung. Writes: auftragsverwaltung (createAuftragsverwaltungEntry / updateAuftragsverwaltungEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconCheck, IconClipboardCheck, IconFileText } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { tx } from '@/i18n';
import { formatDate } from '@/lib/formatters';

export default function AnfrageAbschliessenPage() {
  const STEPS = [{ label: tx('Anfrage wählen') }, { label: tx('Abschliessen') }];

  const { serviceanfrage, auftragsverwaltung, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrageId, setSelectedAnfrageId] = useState<string | null>(null);
  const [erledigungsdatum, setErledigungsdatum] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [notizen, setNotizen] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Find the selected Serviceanfrage record
  const selectedAnfrage = selectedAnfrageId
    ? serviceanfrage.find(a => a.record_id === selectedAnfrageId) ?? null
    : null;

  // Find existing Auftragsverwaltung for a given Anfrage
  const findExistingAuftrag = (anfrageId: string) =>
    auftragsverwaltung.find(av => {
      const ref = extractRecordId(av.fields.anfrage);
      return ref === anfrageId;
    }) ?? null;

  // Filter: only Anfragen that have NO Auftragsverwaltung with erledigt=true
  const offeneAnfragen = serviceanfrage.filter(anfrage => {
    const existingAuftrag = findExistingAuftrag(anfrage.record_id);
    return !existingAuftrag || !existingAuftrag.fields.erledigt;
  });

  const handleAnfrageSelect = (id: string) => {
    setSelectedAnfrageId(id);
    setStep(2);
  };

  const handleAbschliessen = async () => {
    if (!selectedAnfrageId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const existing = findExistingAuftrag(selectedAnfrageId);
      if (existing) {
        await LivingAppsService.updateAuftragsverwaltungEntry(existing.record_id, {
          erledigt: true,
          erledigungsdatum,
          notizen: notizen || undefined,
        });
      } else {
        await LivingAppsService.createAuftragsverwaltungEntry({
          anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, selectedAnfrageId),
          erledigt: true,
          erledigungsdatum,
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
    setErledigungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setNotizen('');
    setSaveError(null);
    setDone(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage abschliessen')}
      subtitle={tx('Serviceanfrage auswählen und als erledigt markieren')}
      steps={STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Anfrage wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map(a => ({
            id: a.record_id,
            title: [a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannter Kunde'),
            subtitle: [a.fields.ort, a.fields.problembeschreibung]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.dringlichkeit
              ? { key: a.fields.dringlichkeit.key, label: a.fields.dringlichkeit.label }
              : undefined,
            icon: <IconClipboardCheck size={20} className="text-primary" />,
          }))}
          onSelect={handleAnfrageSelect}
          searchPlaceholder={tx('Anfrage suchen …')}
          emptyText={tx('Keine offenen Anfragen vorhanden')}
          emptyIcon={<IconClipboardCheck size={40} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Auftrag abschliessen */}
      {step === 2 && (
        <div className="space-y-6">
          {!selectedAnfrage ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">
                {tx('Dieser Schritt braucht eine Auswahl aus Schritt 1.')}
              </p>
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Neu starten')}
              </Button>
            </div>
          ) : done ? (
            <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
              <div className="flex justify-center">
                <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
                  <IconCheck size={36} className="text-emerald-600" stroke={2} />
                </span>
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                {tx('Anfrage erfolgreich abgeschlossen')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {[selectedAnfrage.fields.vorname, selectedAnfrage.fields.nachname]
                  .filter(Boolean)
                  .join(' ')}
                {selectedAnfrage.fields.ort ? ` · ${selectedAnfrage.fields.ort}` : ''}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button onClick={handleReset}>
                  {tx('Weitere Anfrage abschliessen')}
                </Button>
                <Button variant="outline" asChild>
                  <a href="#/">{tx('Zurück zum Dashboard')}</a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Anfrage-Zusammenfassung */}
              <div className="rounded-2xl border bg-secondary/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <IconFileText size={16} className="shrink-0 text-primary" />
                  {[selectedAnfrage.fields.vorname, selectedAnfrage.fields.nachname]
                    .filter(Boolean)
                    .join(' ') || tx('Unbekannter Kunde')}
                  {selectedAnfrage.fields.ort && (
                    <span className="text-muted-foreground font-normal">· {selectedAnfrage.fields.ort}</span>
                  )}
                </div>
                {selectedAnfrage.fields.problembeschreibung && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {selectedAnfrage.fields.problembeschreibung}
                  </p>
                )}
                {selectedAnfrage.fields.dringlichkeit && (
                  <p className="text-xs text-muted-foreground">
                    {tx('Dringlichkeit')}: {selectedAnfrage.fields.dringlichkeit.label}
                  </p>
                )}
              </div>

              {/* Mini-Formular */}
              <div className="rounded-2xl border bg-card p-6 space-y-5">
                <h3 className="text-base font-semibold text-foreground">
                  {tx('Erledigungsdetails')}
                </h3>

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
                  <Label htmlFor="notizen">{tx('Notizen (optional)')}</Label>
                  <Textarea
                    id="notizen"
                    value={notizen}
                    onChange={e => setNotizen(e.target.value)}
                    placeholder={tx('Kurze Beschreibung der durchgeführten Arbeiten …')}
                    rows={4}
                  />
                </div>

                {saveError && (
                  <p className="text-sm text-destructive">{saveError}</p>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Button
                    onClick={handleAbschliessen}
                    disabled={saving || !erledigungsdatum}
                    className="sm:w-auto w-full"
                  >
                    <IconCheck size={16} className="shrink-0 mr-2" />
                    {saving ? tx('Wird gespeichert …') : tx('Als erledigt markieren')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={saving}
                    className="sm:w-auto w-full"
                  >
                    {tx('Andere Anfrage wählen')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </IntentWizardShell>
  );
}
