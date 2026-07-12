import type { RuleSet } from '@lboa/types';
import { accessibilityBonus } from './rules/accessibility-bonus.js';
import { capitalExposure } from './rules/capital-exposure.js';
import { clusterVitality } from './rules/cluster-vitality.js';
import { competitionRisk } from './rules/competition-risk.js';
import { competitorSaturation } from './rules/competitor-saturation.js';
import { demandFragility } from './rules/demand-fragility.js';
import { incomeMismatch } from './rules/income-mismatch.js';
import { lowSignalQuality } from './rules/low-signal-quality.js';
import { marketGap } from './rules/market-gap.js';
import { operationalComplexity } from './rules/operational-complexity.js';
import { populationFloor } from './rules/population-floor.js';
import { rentPressure } from './rules/rent-pressure.js';
import { roadDependence } from './rules/road-dependence.js';
import { ruralContext } from './rules/rural-context.js';
import { signalAlignment } from './rules/signal-alignment.js';
import { signalMisfit } from './rules/signal-misfit.js';
import { synergyPresence } from './rules/synergy-presence.js';
import { transitDependence } from './rules/transit-dependence.js';
import { vacancyClimate } from './rules/vacancy-climate.js';
import { vacancyRisk } from './rules/vacancy-risk.js';

/** Standard rule set — generic over (profile, signals); never references concrete business type ids. */
export const standardRuleSet: RuleSet = {
  id: 'standard',
  version: '1.1.0',
  description:
    'Standard deterministic rule set v1.1: opportunity alignment/misfit, market structure, ' +
    'structural dependence (transit/road), cluster vitality, context overlays, risk factors, ' +
    'and confidence adjustments.',
  rules: [
    accessibilityBonus,
    capitalExposure,
    clusterVitality,
    competitionRisk,
    competitorSaturation,
    demandFragility,
    incomeMismatch,
    lowSignalQuality,
    marketGap,
    operationalComplexity,
    populationFloor,
    rentPressure,
    roadDependence,
    ruralContext,
    signalAlignment,
    signalMisfit,
    synergyPresence,
    transitDependence,
    vacancyClimate,
    vacancyRisk,
  ],
  paramOverrides: {},
};
