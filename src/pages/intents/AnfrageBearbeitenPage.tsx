/**
 * Anfrage bearbeiten — 3-Schritt-Wizard.
 * Steps: 1) Serviceanfrage wählen (nur ohne verknüpften Auftrag) →
 *        2) Auftrag anlegen (Notizen, Erledigungsstatus, Datum) →
 *        3) Bestätigung mit Zusammenfassung.
 * Reads: serviceanfrage, auftragsverwaltung.
 * Writes: auftragsverwaltung (createAuftragsverwaltungEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Serviceanfrage } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tx } from '@/i18n';
import { formatDate } from '@/lib/formatters';
import {
  IconAlertTriangle,
  IconCheck,
  IconClipboardList,
  IconMapPin,
  IconPhone,
  IconUser,
  IconCalendar,
} from '@tabler/icons-react';

export default function AnfrageBearbeitenPage() {
  const data = useDashboardData();
  const { serviceanfrage, auftragsverwaltung, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedAnfrageId, setSelectedAnfrageId] = useState<string | null>(null);

  // Step 2 form state
  const [notizen, setNotizen] = useState('');
  const [erledigt, setErledigt] = useState(false);
  const [erledigungsdatum, setErledigungsdatum] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdAuftragId, setCreatedAuftragId] = useState<string | null>(null);

  // Compute which anfragen already have an Auftrag
  const anfrageIdsWithAuftrag = new Set(
    auftragsverwaltung
      .map(a => {
        const url = a.fields.anfrage;
        if (!url) return null;
        return extractRecordId(url);
      })
      .filter((id): id is string => id !== null)
  );

  // Filter: Anfragen ohne verknüpften Auftrag
  const offeneAnfragen = serviceanfrage.filter(
    a => !anfrageIdsWithAuftrag.has(a.record_id)
  );

  // Falls alle verknüpft sind, alle anzeigen
  const listeAnzeigen = offeneAnfragen.length > 0 ? offeneAnfragen : serviceanfrage;

  const selectedAnfrage: Serviceanfrage | undefined = serviceanfrage.find(
    a => a.record_id === selectedAnfrageId
  );

  const dringlichkeitOptions = LOOKUP_OPTIONS['serviceanfrage']?.['dringlichkeit'] ?? [];

  function dringlichkeitLabel(key: string | undefined) {
    if (!key) return '';
    return dringlichkeitOptions.find(o => o.key === key)?.label ?? key;
  }

  function getDringlichkeitTone(key: string | undefined): 'destructive' | 'warning' | 'default' {
    if (key === 'notfall') return 'destructive';
    if (key === 'dringend') return 'warning';
    return 'default';
  }

  function handleReset() {
    setStep(1);
    setSelectedAnfrageId(null);
    setNotizen('');
    setErledigt(false);
    setErledigungsdatum('');
    setSubmitting(false);
    setSubmitError(null);
    setCreatedAuftragId(null);
  }

  async function handleAuftragAnlegen() {
    if (!selectedAnfrageId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let aid = createdAuftragId;
      if (!aid) {
        const payload: {
          anfrage: string;
          notizen?: string;
          erledigt?: boolean;
          erledigungsdatum?: string;
        } = {
          anfrage: createRecordUrl(APP_IDS.SERVICEANFRAGE, selectedAnfrageId),
        };
        if (notizen) payload.notizen = notizen;
        payload.erledigt = erledigt;
        if (erledigt && erledigungsdatum) {
          payload.erledigungsdatum = erledigungsdatum;
        }
        const result = await LivingAppsService.createAuftragsverwaltungEntry(payload);
        aid = result.record_id;
        setCreatedAuftragId(aid);
      }
      await fetchAll();
      setStep(3);
    } catch (e) {
      setSubmitError(tx('Fehler beim Anlegen des Auftrags. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <IntentWizardShell
      title={tx('Anfrage bearbeiten')}
      subtitle={tx('Serviceanfrage auswählen und Auftrag anlegen')}
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
      {/* ── Schritt 1: Anfrage wählen ─────────────────────────────────── */}
      {step === 1 && (
        <EntitySelectStep
          searchPlaceholder={tx('Anfrage suchen …')}
          items={listeAnzeigen.map(a => {
            const dringKey = a.fields.dringlichkeit?.key;
            const dringLbl = a.fields.dringlichkeit?.label ?? dringlichkeitLabel(dringKey);
            const name = [a.fields.vorname, a.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt');
            const ort = a.fields.ort ?? '';
            const beschreibung = a.fields.problembeschreibung
              ? a.fields.problembeschreibung.length > 80
                ? a.fields.problembeschreibung.slice(0, 80) + '…'
                : a.fields.problembeschreibung
              : '';
            const alreadyLinked = anfrageIdsWithAuftrag.has(a.record_id);
            return {
              id: a.record_id,
              title: name,
              subtitle: [ort, beschreibung].filter(Boolean).join(' · '),
              status: a.fields.dringlichkeit
                ? { key: dringKey ?? '', label: dringLbl }
                : undefined,
              stats: alreadyLinked
                ? [{ label: tx('Status'), value: tx('Bereits verknüpft') }]
                : undefined,
              icon: <IconClipboardList size={20} className="text-primary shrink-0" />,
            };
          })}
          onSelect={(id) => {
            setSelectedAnfrageId(id);
            setStep(2);
          }}
          emptyText={tx('Keine offenen Anfragen gefunden.')}
          emptyIcon={<IconClipboardList size={48} className="text-muted-foreground" />}
        />
      )}

      {/* ── Schritt 2: Auftrag anlegen ────────────────────────────────── */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Vorschau der gewählten Anfrage */}
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <IconUser size={18} className="text-muted-foreground shrink-0" />
                  <span className="font-semibold text-foreground truncate">
                    {[selectedAnfrage.fields.vorname, selectedAnfrage.fields.nachname]
                      .filter(Boolean)
                      .join(' ') || tx('Unbekannt')}
                  </span>
                </div>
                {selectedAnfrage.fields.dringlichkeit && (
                  <StatusBadge
                    statusKey={selectedAnfrage.fields.dringlichkeit.key}
                    label={selectedAnfrage.fields.dringlichkeit.label}
                  />
                )}
              </div>

              {(selectedAnfrage.fields.strasse || selectedAnfrage.fields.ort) && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <IconMapPin size={16} className="shrink-0 mt-0.5" />
                  <span>
                    {[
                      [selectedAnfrage.fields.strasse, selectedAnfrage.fields.hausnummer]
                        .filter(Boolean)
                        .join(' '),
                      [selectedAnfrage.fields.plz, selectedAnfrage.fields.ort]
                        .filter(Boolean)
                        .join(' '),
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}

              {selectedAnfrage.fields.telefon && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconPhone size={16} className="shrink-0" />
                  <span>{selectedAnfrage.fields.telefon}</span>
                </div>
              )}

              {selectedAnfrage.fields.problembeschreibung && (
                <p className="text-sm text-foreground border-t pt-3 mt-1">
                  {selectedAnfrage.fields.problembeschreibung}
                </p>
              )}
            </div>

            {/* Auftragsformular */}
            <div className="rounded-2xl border bg-card p-5 space-y-5">
              <h2 className="font-semibold text-foreground">{tx('Auftrag anlegen')}</h2>

              <div className="space-y-2">
                <Label htmlFor="notizen">{tx('Notizen')}</Label>
                <Textarea
                  id="notizen"
                  value={notizen}
                  onChange={e => setNotizen(e.target.value)}
                  placeholder={tx('Optionale Anmerkungen zum Auftrag …')}
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="erledigt"
                  checked={erledigt}
                  onCheckedChange={v => setErledigt(v === true)}
                />
                <Label htmlFor="erledigt" className="cursor-pointer select-none">
                  {tx('Direkt als erledigt markieren')}
                </Label>
              </div>

              {erledigt && (
                <div className="space-y-2">
                  <Label htmlFor="erledigungsdatum">
                    <span className="flex items-center gap-1.5">
                      <IconCalendar size={16} className="shrink-0" />
                      {tx('Erledigungsdatum')}
                    </span>
                  </Label>
                  <Input
                    id="erledigungsdatum"
                    type="date"
                    value={erledigungsdatum}
                    onChange={e => setErledigungsdatum(e.target.value)}
                  />
                </div>
              )}

              {submitError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <IconAlertTriangle size={16} className="shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex gap-3 flex-wrap pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                >
                  {tx('Zurück')}
                </Button>
                <Button
                  onClick={handleAuftragAnlegen}
                  disabled={submitting}
                  className="flex-1 sm:flex-none"
                >
                  {submitting ? tx('Wird angelegt …') : tx('Auftrag anlegen')}
                </Button>
              </div>
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

      {/* ── Schritt 3: Bestätigung ────────────────────────────────────── */}
      {step === 3 && (
        createdAuftragId && selectedAnfrage ? (
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Erfolgsanzeige */}
            <div className="rounded-2xl border bg-card p-6 text-center space-y-3">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-100 p-3">
                  <IconCheck size={32} className="text-emerald-600" />
                </div>
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                {tx('Auftrag erfolgreich angelegt')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {tx('Der Auftrag wurde erstellt und mit der Serviceanfrage verknüpft.')}
              </p>
            </div>

            {/* Zusammenfassung */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide text-muted-foreground">
                {tx('Zusammenfassung')}
              </h3>

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <IconUser size={16} className="text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">
                      {[selectedAnfrage.fields.vorname, selectedAnfrage.fields.nachname]
                        .filter(Boolean)
                        .join(' ') || tx('Unbekannt')}
                    </span>
                  </div>
                  {selectedAnfrage.fields.dringlichkeit && (
                    <StatusBadge
                      statusKey={selectedAnfrage.fields.dringlichkeit.key}
                      label={selectedAnfrage.fields.dringlichkeit.label}
                    />
                  )}
                </div>

                {(selectedAnfrage.fields.strasse || selectedAnfrage.fields.ort) && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <IconMapPin size={16} className="shrink-0 mt-0.5" />
                    <span>
                      {[
                        [selectedAnfrage.fields.strasse, selectedAnfrage.fields.hausnummer]
                          .filter(Boolean)
                          .join(' '),
                        [selectedAnfrage.fields.plz, selectedAnfrage.fields.ort]
                          .filter(Boolean)
                          .join(' '),
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}

                {notizen && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground mb-1">{tx('Notizen')}</p>
                    <p className="text-sm text-foreground">{notizen}</p>
                  </div>
                )}

                <div className="border-t pt-3 flex items-center gap-2">
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      erledigt
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    <IconCheck size={12} className="shrink-0" />
                    {erledigt ? tx('Erledigt') : tx('Offen')}
                  </div>
                  {erledigt && erledigungsdatum && (
                    <span className="text-xs text-muted-foreground">
                      {formatDate(erledigungsdatum)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex gap-3 flex-wrap">
              <Button onClick={handleReset} variant="outline" className="flex-1 sm:flex-none">
                {tx('Neue Anfrage bearbeiten')}
              </Button>
              <Button asChild className="flex-1 sm:flex-none">
                <a href="#/">{tx('Zur Übersicht')}</a>
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
    </IntentWizardShell>
  );
}
