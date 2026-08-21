/**
 * Auftrag Abliessen — 2-Schritt-Wizard.
 * Steps: 1) Offenen Auftrag wählen → 2) Abschließen (Erledigungsdatum + Notizen eingeben).
 * Reads: auftragsverwaltung, serviceanfrage (via serviceanfrageMap aus useDashboardData).
 * Writes: auftragsverwaltung (updateAuftragsverwaltungEntry — setzt erledigt=true, erledigungsdatum, notizen).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IconCheck, IconClipboardCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichAuftragsverwaltung } from '@/lib/enrich';
import { LivingAppsService } from '@/services/livingAppsService';
import type { EnrichedAuftragsverwaltung } from '@/types/enriched';
import { tx } from '@/i18n';

export default function AuftragAbliessenPage() {
  const data = useDashboardData();
  const { auftragsverwaltung, serviceanfrageMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedAuftrag, setSelectedAuftrag] = useState<EnrichedAuftragsverwaltung | null>(null);
  const [erledigungsdatum, setErledigungsdatum] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notizen, setNotizen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const enriched = enrichAuftragsverwaltung(auftragsverwaltung, { serviceanfrageMap });

  const offeneAuftraege = enriched.filter(
    a => a.fields.erledigt !== true
  );

  const handleSelectAuftrag = (id: string) => {
    const found = enriched.find(a => a.record_id === id);
    if (found) {
      setSelectedAuftrag(found);
      setStep(2);
    }
  };

  const handleAbschliessen = async () => {
    if (!selectedAuftrag) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateAuftragsverwaltungEntry(selectedAuftrag.record_id, {
        erledigt: true,
        erledigungsdatum,
        notizen: notizen || undefined,
      });
      await fetchAll();
      setDone(true);
    } catch {
      setSubmitError(tx('Fehler beim Speichern. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedAuftrag(null);
    setErledigungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setNotizen('');
    setSubmitError(null);
    setDone(false);
  };

  const dringlichkeitLabel = (auftrag: EnrichedAuftragsverwaltung) => {
    const anfrage = Array.from(serviceanfrageMap.values()).find(
      s => auftrag.fields.anfrage?.includes(s.record_id)
    );
    return anfrage?.fields.dringlichkeit?.label ?? null;
  };

  return (
    <IntentWizardShell
      title={tx('Auftrag abschließen')}
      subtitle={tx('Markiere einen offenen Auftrag als erledigt')}
      steps={[{ label: tx('Auftrag wählen') }, { label: tx('Abschließen') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {step === 1 && (
        <EntitySelectStep
          items={offeneAuftraege.map(a => {
            const dringlichkeit = dringlichkeitLabel(a);
            return {
              id: a.record_id,
              title: a.anfrageName || tx('Auftrag ohne Anfrage'),
              subtitle: dringlichkeit ? `${tx('Dringlichkeit')}: ${dringlichkeit}` : undefined,
              icon: <IconClipboardCheck size={20} className="text-primary" />,
            };
          })}
          onSelect={handleSelectAuftrag}
          searchPlaceholder={tx('Auftrag suchen …')}
          emptyText={tx('Keine offenen Aufträge vorhanden')}
          emptyIcon={<IconClipboardCheck size={40} className="text-muted-foreground" />}
        />
      )}

      {step === 2 && (
        selectedAuftrag ? (
          <div className="space-y-6 max-w-lg">
            {done ? (
              <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-emerald-100 p-4">
                    <IconCheck size={40} className="text-emerald-600" />
                  </div>
                </div>
                <h2 className="text-lg font-semibold">{tx('Auftrag erfolgreich abgeschlossen')}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedAuftrag.anfrageName
                    ? tx`Auftrag für ${selectedAuftrag.anfrageName} wurde als erledigt markiert.`
                    : tx('Der Auftrag wurde als erledigt markiert.')}
                </p>
                <div className="flex flex-col gap-2 pt-2">
                  <Button onClick={handleReset} variant="outline">
                    {tx('Weiteren Auftrag abschließen')}
                  </Button>
                  <a href="#/" className="text-sm text-center text-muted-foreground hover:text-foreground underline underline-offset-4">
                    {tx('Zurück zum Dashboard')}
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border bg-card p-6 space-y-5">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{tx('Auftrag')}</p>
                  <p className="font-medium">
                    {selectedAuftrag.anfrageName || tx('Auftrag ohne Anfrage')}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="erledigungsdatum">
                    {tx('Erledigungsdatum')}
                  </label>
                  <Input
                    id="erledigungsdatum"
                    type="date"
                    value={erledigungsdatum}
                    onChange={e => setErledigungsdatum(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="notizen">
                    {tx('Notizen')} <span className="text-muted-foreground font-normal">({tx('optional')})</span>
                  </label>
                  <Textarea
                    id="notizen"
                    value={notizen}
                    onChange={e => setNotizen(e.target.value)}
                    placeholder={tx('Hinweise zur Erledigung …')}
                    rows={4}
                  />
                </div>

                {submitError && (
                  <p className="text-sm text-destructive">{submitError}</p>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  <Button
                    onClick={handleAbschliessen}
                    disabled={submitting || !erledigungsdatum}
                    className="w-full"
                  >
                    <IconCheck size={16} className="shrink-0 mr-2" />
                    {submitting ? tx('Wird gespeichert …') : tx('Auftrag als erledigt markieren')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                    className="w-full"
                  >
                    {tx('Anderen Auftrag wählen')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
