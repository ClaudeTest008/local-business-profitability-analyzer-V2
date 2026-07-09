export { evaluateRules } from './evaluate.js';
export { standardRuleSet } from './rule-set.js';
export {
  UNIT_KNEE_PARAMS,
  computeAlignments,
  evidenceOf,
  fmt,
  fmtPct,
  fmtSignal,
  ruleParams,
  signalValue,
} from './helpers.js';
export type { AlignedSignal, UnitKnees } from './helpers.js';

export { accessibilityBonus } from './rules/accessibility-bonus.js';
export { capitalExposure } from './rules/capital-exposure.js';
export { competitionRisk } from './rules/competition-risk.js';
export { competitorSaturation } from './rules/competitor-saturation.js';
export { demandFragility } from './rules/demand-fragility.js';
export { incomeMismatch } from './rules/income-mismatch.js';
export { lowSignalQuality } from './rules/low-signal-quality.js';
export { marketGap } from './rules/market-gap.js';
export { operationalComplexity } from './rules/operational-complexity.js';
export { populationFloor } from './rules/population-floor.js';
export { rentPressure } from './rules/rent-pressure.js';
export { ruralContext } from './rules/rural-context.js';
export { signalAlignment } from './rules/signal-alignment.js';
export { signalMisfit } from './rules/signal-misfit.js';
export { synergyPresence } from './rules/synergy-presence.js';
export { vacancyClimate } from './rules/vacancy-climate.js';
export { vacancyRisk } from './rules/vacancy-risk.js';
