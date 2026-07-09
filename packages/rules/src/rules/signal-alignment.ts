import type { RuleDefinition } from '@lboa/types';
import { round, weightedMean } from '@lboa/shared';
import {
  UNIT_KNEE_PARAMS,
  computeAlignments,
  evidenceOf,
  fmt,
  fmtSignal,
  ruleParams,
} from '../helpers.js';

const DEFAULTS = { maxPoints: 25, ...UNIT_KNEE_PARAMS };

export const signalAlignment: RuleDefinition = {
  id: 'signal-alignment',
  version: '1.0.0',
  kind: 'positive',
  target: 'opportunity',
  description:
    'Rewards locations whose present signals align with the profile signal preferences; only positive-leaning alignments (>= 0.5) contribute, weighted by preference weight.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const entries = computeAlignments(ctx.profile, ctx.signals, p);
    const aligned = entries.filter((e) => e.alignment >= 0.5);
    if (aligned.length === 0) return null;
    const contribution = round(
      p.maxPoints * weightedMean(aligned.map((e) => ({ value: e.alignment, weight: e.weight }))),
      4,
    );
    const strongest = [...aligned]
      .sort((a, b) => b.alignment - a.alignment || (a.key < b.key ? -1 : 1))
      .slice(0, 2)
      .map((e) => `${e.key} at ${fmtSignal(e.signal)} (alignment ${fmt(e.alignment)})`)
      .join(' and ');
    return {
      ruleId: 'signal-alignment',
      ruleVersion: '1.0.0',
      kind: 'positive',
      target: 'opportunity',
      contribution,
      rationale: `${aligned.length} of ${entries.length} preferred signals align with this profile; strongest: ${strongest}.`,
      evidenceIds: evidenceOf(ctx.signals, ...entries.map((e) => e.key)),
    };
  },
};
