import type { RuleContext, RuleOutcome, RuleSet } from '@lboa/types';

/**
 * Evaluate every rule of the set against (profile, signals, location).
 * Per rule: params = defaultParams merged with the set's paramOverrides[rule.id].
 * Non-applicable rules (null) are dropped; outcomes are sorted by ruleId for determinism.
 * A throwing rule is a programming error — rethrown with rule id context, never swallowed.
 */
export function evaluateRules(ruleSet: RuleSet, ctx: Omit<RuleContext, 'params'>): RuleOutcome[] {
  const outcomes: RuleOutcome[] = [];
  for (const rule of ruleSet.rules) {
    const params = { ...rule.defaultParams, ...ruleSet.paramOverrides[rule.id] };
    let outcome: RuleOutcome | null;
    try {
      outcome = rule.evaluate({ ...ctx, params });
    } catch (error) {
      throw new Error(
        `rule '${rule.id}' (v${rule.version}) threw during evaluation: ${String(error)}`,
        { cause: error },
      );
    }
    if (outcome !== null) outcomes.push(outcome);
  }
  outcomes.sort((a, b) => (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0));
  return outcomes;
}
