import type { RuleSet } from '@lboa/types';
import { accessibilityBonus } from './rules/accessibility-bonus.js';
import { capitalExposure } from './rules/capital-exposure.js';
import { competitionRisk } from './rules/competition-risk.js';
import { competitorSaturation } from './rules/competitor-saturation.js';
import { demandFragility } from './rules/demand-fragility.js';
import { incomeMismatch } from './rules/income-mismatch.js';
import { lowSignalQuality } from './rules/low-signal-quality.js';
import { marketGap } from './rules/market-gap.js';
import { operationalComplexity } from './rules/operational-complexity.js';
import { populationFloor } from './rules/population-floor.js';
import { rentPressure } from './rules/rent-pressure.js';
import { ruralContext } from './rules/rural-context.js';
import { signalAlignment } from './rules/signal-alignment.js';
import { signalMisfit } from './rules/signal-misfit.js';
import { synergyPresence } from './rules/synergy-presence.js';
import { vacancyClimate } from './rules/vacancy-climate.js';
import { vacancyRisk } from './rules/vacancy-risk.js';

/** Standard rule set v1 — generic over (profile, signals); never references concrete business type ids. */
export const standardRuleSet: RuleSet = {
  id: 'standard',
  version: '1.0.0',
  description:
    'Standard deterministic rule set v1: opportunity alignment/misfit, market structure, context overlays, risk factors, and confidence adjustments.',
  rules: [
    accessibilityBonus,
    capitalExposure,
    competitionRisk,
    competitorSaturation,
    demandFragility,
    incomeMismatch,
    lowSignalQuality,
    marketGap,
    operationalComplexity,
    populationFloor,
    rentPressure,
    ruralContext,
    signalAlignment,
    signalMisfit,
    synergyPresence,
    vacancyClimate,
    vacancyRisk,
  ],
  paramOverrides: {},
};
