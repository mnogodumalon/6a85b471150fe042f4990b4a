/**
 * useAuftragErledigenFlow — the plumbing of the flow « Auftrag abhaken », generated from the plan.
 *
 * Changes `auftragsverwaltung`: the record to change is picked (`flow.pick('auftragsverwaltung')`), the form is prefilled with its values; asks `notizen`; sets `erledigt`, `erledigungsdatum` itself.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 3)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   const flow = useAuftragErledigenFlow({
 *     steps: { auftragsverwaltung: 1, notizen: 2 },
 *     items: { auftragsverwaltung: r => ({ id: r.id, title: fieldText(r, 'notizen') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.auftragsverwaltung.select} {...flow.pick('auftragsverwaltung')} />
 *     <Bound form={flow.forms.auftragsverwaltung} name="notizen" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import { useState } from 'react';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';
export type AuftragErledigenFieldKey = 'auftragsverwaltung' | 'notizen';

export interface AuftragErledigenForms {
  auftragsverwaltung: StepForm<'auftragsverwaltung'>;
}

// Alias so the option generics stay readable.
type Key = AuftragErledigenFieldKey;

export interface AuftragErledigenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    auftragsverwaltung?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"auftragsverwaltung": 1, "notizen": 2};
export const AUFTRAGERLEDIGEN_REVIEW_STEP = 3;

function fromPick<T>(pick: { recordOf(id: string): JourneyRecord | undefined }, form: StepForm, field: string, read: (r: JourneyRecord) => T): T | undefined {
  const id = form.get(field);
  const rec = typeof id === 'string' && id ? pick.recordOf(id) : undefined;
  return rec ? read(rec) : undefined;
}
function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns T, not Partial<T>: a Record's index signature is already "maybe
// absent", and Partial<Record<string, string>> does not assign to the
// Record<string, string> useStepForm wants (tsc, live 23.09.2026 — eight
// errors, one per hook, caught only in the sandbox build).
function only<T extends Record<string, unknown>>(obj: T | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out as T;
}

function hasValues(form: StepForm): boolean {
  return form.keys.some(k => !isEmptyValue(form.values[k]));
}

export function useAuftragErledigenFlow(options: AuftragErledigenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const [auftragsverwaltungTargetId, setAuftragsverwaltungTargetId] = useState<string | null>(null);
  const auftragsverwaltung = useStepForm('auftragsverwaltung', {
    fields: ["notizen"],
    steps: only(steps, ["notizen"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["notizen"]),
    messages: only(options.messages as Record<string, string> | undefined, ["notizen"]),
  });
  const forms: AuftragErledigenForms = { auftragsverwaltung };
  const formList: StepForm[] = [auftragsverwaltung];

  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    auftragsverwaltung: useRecordSearch(servicePort, 'auftragsverwaltung', withPickPolicy('auftragsverwaltung', {
      searchFields: ["notizen"] as never,
      filter: "r.v_erledigt == False",
      where: (r: JourneyRecord) => r.fields["erledigt"] === false,
      toItem: options.items?.auftragsverwaltung as never,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:auftrag-erledigen:read:${entity}`);
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:auftrag-erledigen:write:${entity}.${field}`,
  });
  const picks = {
    auftragsverwaltung: { ...searches.auftragsverwaltung, select: { ...searches.auftragsverwaltung.select, create: false as boolean, hint: hintFor('auftragsverwaltung', 'auftragsverwaltung', {"conditions": [{"field": "erledigt", "op": "eq", "value": "false"}], "mode": "all"} as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'auftragsverwaltung', entity: 'auftragsverwaltung', form: auftragsverwaltung, primary: true,
      updates: () => auftragsverwaltungTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => auftragsverwaltungTargetId
        ? { key: 'target:auftragsverwaltung', label: entityLabel('auftragsverwaltung'), value: picks.auftragsverwaltung.labelOf(auftragsverwaltungTargetId) ?? auftragsverwaltungTargetId, step: steps.auftragsverwaltung }
        : undefined,
      values: (): FormValues => ({
        erledigt: policyFixedValue('auftragsverwaltung', 'erledigt') ?? true,
        erledigungsdatum: policyFixedValue('auftragsverwaltung', 'erledigungsdatum') ?? todayIso(),
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('auftragsverwaltung', 'erledigt', policyFixedValue('auftragsverwaltung', 'erledigt') ?? true)],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'auftrag-erledigen' });

  /** The record(s) this flow CHANGES: picked through {...flow.picks.<entity>.select} {...flow.pick('<entity>')};
   *  picking prefills the form with the record's current values, and the plan step updates that record. */
  const targets = {
    auftragsverwaltung: {
      selectedId: auftragsverwaltungTargetId,
      onSelect: (id: string) => {
        setAuftragsverwaltungTargetId(id);
        const rec = picks.auftragsverwaltung.recordOf(id);
        if (rec) auftragsverwaltung.reset({ notizen: fieldText(rec, "notizen"), });
      },
      get record(): JourneyRecord | undefined { return auftragsverwaltungTargetId ? picks.auftragsverwaltung.recordOf(auftragsverwaltungTargetId) : undefined; },
    },
  };
  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: AuftragErledigenFieldKey) => {
    if (field in targets) {
      const t = targets[field as keyof typeof targets];
      return { selectedId: t.selectedId, onSelect: t.onSelect };
    }
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return {
      selectedId: (typeof owner.get(field) === 'string' ? (owner.get(field) as string) : null) || null,
      // `field as never` collapsed the conditional SetArgs<E, never> to never and
      // no argument was assignable any more (tsc, live 23.09.2026); widen `set`
      // itself instead — the label stays a required third argument.
      onSelect: (id: string) => (owner.set as (k: string, v: unknown, l?: string) => void)(field, id, search?.labelOf(id)),
    };
  };
  /** Props for a multi-record pick step: {...flow.picks.x.select} {...flow.pickMany('x')} */
  const pickMany = (field: AuftragErledigenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    && Object.entries(targets).every(([k, t]) => steps[k] !== n || !!t.selectedId);
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); setAuftragsverwaltungTargetId(null); };

  return {
    slug: 'auftrag-erledigen' as const,
    draftKey: 'auftrag-erledigen' as const,
    entity: 'auftragsverwaltung' as const,
    form: auftragsverwaltung,
    forms, formList, picks, submit, steps, targets,    reviewStep: AUFTRAGERLEDIGEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
  };
}

export type AuftragErledigenFlow = ReturnType<typeof useAuftragErledigenFlow>;
