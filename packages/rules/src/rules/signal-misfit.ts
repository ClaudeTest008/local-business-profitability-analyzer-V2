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

const DEFAULTS = { maxPoints: 20, ...UNIT_KNEE_PARAMS };

export const signalMisfit: RuleDefinition = {
  id: 'signal-misfit',
  version: '1.0.0',
  kind: 'negative',
  target: 'opportunity',
  description:
    'Penalizes locations whose present signals conflict with the profile signal preferences; alignments below 0.5 contribute with misfit strength (0.5 - alignment) * 2, weighted by preference weight.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const entries = computeAlignments(ctx.profile, ctx.signals, p);
    const misfits = entries.filter((e) => e.alignment < 0.5);
    if (misfits.length === 0) return null;
    const contribution = round(
      -p.maxPoints *
        weightedMean(misfits.map((e) => ({ value: (0.5 - e.alignment) * 2, weight: e.weight }))),
      4,
    );
    const worst = [...misfits]
      .sort((a, b) => a.alignment - b.alignment || (a.key < b.key ? -1 : 1))
      .slice(0, 2)
      .map((e) => `${e.key} at ${fmtSignal(e.signal)} (alignment ${fmt(e.alignment)})`)
      .join(' and ');
    return {
      ruleId: 'signal-misfit',
      ruleVersion: '1.0.0',
      kind: 'negative',
      target: 'opportunity',
      contribution,
      rationale: `${misfits.length} of ${entries.length} preferred signals conflict with this profile; worst: ${worst}.`,
      evidenceIds: evidenceOf(ctx.signals, ...entries.map((e) => e.key)),
    };
  },
};
