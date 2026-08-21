/**
 * Auftrag erledigen — 2-Schritt-Wizard.
 * Steps: 1) Auftrag wählen (nur nicht erledigte Einträge) → 2) Abschließen (Notizen + Erledigungsdatum).
 * Reads: auftragsverwaltung, serviceanfrage. Writes: auftragsverwaltung (updateAuftragsverwaltungEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IconClipboardCheck, IconCircleCheck } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichAuftragsverwaltung } from '@/lib/enrich';
import type { EnrichedAuftragsverwaltung } from '@/types/enriched';
import { LivingAppsService } from '@/services/livingAppsService';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function AuftragErledigePage() {
  const data = useDashboardData();
  const { auftragsverwaltung, serviceanfrageMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedAuftrag, setSelectedAuftrag] = useState<EnrichedAuftragsverwaltung | null>(null);
  const [notizen, setNotizen] = useState('');
  const [erledigungsdatum, setErledigungsdatum] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const enriched = enrichAuftragsverwaltung(auftragsverwaltung, { serviceanfrageMap });
  const offene = enriched.filter(a => !a.fields.erledigt);

  const handleSelectAuftrag = (id: string) => {
    const found = offene.find(a => a.record_id === id);
    if (!found) return;
    setSelectedAuftrag(found);
    setNotizen(found.fields.notizen ?? '');
    setStep(2);
  };

  const handleAbschliessen = async () => {
    if (!selectedAuftrag || !erledigungsdatum) return;
    setSubmitting(true);
    try {
      await LivingAppsService.updateAuftragsverwaltungEntry(selectedAuftrag.record_id, {
        erledigt: true,
        erledigungsdatum,
        notizen: notizen || undefined,
      });
      await fetchAll();
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedAuftrag(null);
    setNotizen('');
    setErledigungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setDone(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Auftrag erledigen')}
      subtitle={tx('Offenen Auftrag auswählen und als erledigt markieren')}
      steps={[{ label: tx('Auftrag wählen') }, { label: tx('Abschließen') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {step === 1 && (
        <EntitySelectStep
          items={offene.map(a => {
            const anfrage = a.fields.anfrage
              ? serviceanfrageMap.get(
                  a.fields.anfrage.replace(/.*\//, '')
                )
              : undefined;
            const dringlichkeit = anfrage?.fields.dringlichkeit?.label;
            const ort = anfrage?.fields.ort;
            const problem = anfrage?.fields.problembeschreibung;
            const parts = [dringlichkeit, ort, problem].filter(Boolean);
            return {
              id: a.record_id,
              title: a.anfrageName || tx('Unbenannter Auftrag'),
              subtitle: parts.length > 0 ? parts.join(' · ') : undefined,
              icon: <IconClipboardCheck size={20} className="text-primary" />,
            };
          })}
          onSelect={handleSelectAuftrag}
          searchPlaceholder={tx('Auftrag suchen …')}
          emptyText={tx('Keine offenen Aufträge vorhanden')}
          emptyIcon={<IconClipboardCheck size={32} className="text-muted-foreground" />}
        />
      )}

      {step === 2 && (
        <>
          {selectedAuftrag ? (
            done ? (
              <div className="flex flex-col items-center gap-6 py-12 text-center">
                <IconCircleCheck size={56} className="text-emerald-500" />
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{tx('Auftrag erledigt!')}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAuftrag.anfrageName}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={handleReset} variant="outline">
                    {tx('Weiteren Auftrag erledigen')}
                  </Button>
                  <Button asChild>
                    <a href="#/">{tx('Zurück zum Dashboard')}</a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-lg mx-auto">
                <div className="rounded-2xl border bg-secondary/40 p-4 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {tx('Gewählter Auftrag')}
                  </p>
                  <p className="font-semibold">{selectedAuftrag.anfrageName}</p>
                  {(() => {
                    const anfrage = selectedAuftrag.fields.anfrage
                      ? serviceanfrageMap.get(
                          selectedAuftrag.fields.anfrage.replace(/.*\//, '')
                        )
                      : undefined;
                    if (!anfrage) return null;
                    return (
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        {anfrage.fields.problembeschreibung && (
                          <p className="line-clamp-2">{anfrage.fields.problembeschreibung}</p>
                        )}
                        {(anfrage.fields.dringlichkeit || anfrage.fields.ort) && (
                          <p>
                            {[anfrage.fields.dringlichkeit?.label, anfrage.fields.ort]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="erledigungsdatum">{tx('Erledigungsdatum')}</Label>
                  <Input
                    id="erledigungsdatum"
                    type="date"
                    value={erledigungsdatum}
                    onChange={e => setErledigungsdatum(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notizen">
                    {tx('Notizen')}{' '}
                    <span className="text-muted-foreground font-normal">
                      ({tx('optional')})
                    </span>
                  </Label>
                  <Textarea
                    id="notizen"
                    value={notizen}
                    onChange={e => setNotizen(e.target.value)}
                    placeholder={tx('Anmerkungen zur Erledigung …')}
                    rows={4}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                  >
                    {tx('Zurück')}
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!erledigungsdatum || submitting}
                    onClick={handleAbschliessen}
                  >
                    {submitting ? tx('Wird gespeichert …') : tx('Als erledigt markieren')}
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
          )}
        </>
      )}
    </IntentWizardShell>
  );
}
