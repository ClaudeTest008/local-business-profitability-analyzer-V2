import type {
  BusinessTypeProfile,
  Location,
  RuleContext,
  RuleDefinition,
  RuleOutcome,
  RuleParams,
  Signal,
  SignalKey,
  SignalMap,
} from '@lboa/types';
import { SIGNAL_UNIT_BY_KEY } from '@lboa/types';

export const testLocation: Location = { point: { lat: 52.52, lon: 13.405 }, radiusM: 800 };

export function makeSignal(key: SignalKey, value: number, quality = 0.8): Signal {
  return {
    key,
    value,
    unit: SIGNAL_UNIT_BY_KEY[key],
    quality,
    method: `test-fixture ${key}`,
    evidenceIds: [`ev_${key}`],
  };
}

export function makeSignals(...signals: Signal[]): SignalMap {
  const map: SignalMap = {};
  for (const signal of signals) map[signal.key] = signal;
  return map;
}

export function makeProfile(overrides: Partial<BusinessTypeProfile> = {}): BusinessTypeProfile {
  return {
    id: 'test-type',
    name: 'Test Type',
    categoryId: 'test-category',
    subcategoryId: 'test-subcategory',
    description: 'fixture profile',
    signalPreferences: [{ signal: 'footTraffic', weight: 0.8, direction: 'higher_better' }],
    requiredSignals: ['footTraffic'],
    competitionSensitivity: 0.8,
    synergyTypeIds: [],
    rivalTypeIds: [],
    minViablePopulationDensity: 0,
    capitalIntensity: 2,
    operationalComplexity: 2,
    osmTags: [],
    tags: [],
    ...overrides,
  };
}

export function makeCtx(
  profile: BusinessTypeProfile,
  signals: SignalMap,
): Omit<RuleContext, 'params'> {
  return { profile, signals, location: testLocation };
}

/** Run one rule with its defaultParams (plus optional overrides), like evaluateRules would. */
export function runRule(
  rule: RuleDefinition,
  profile: BusinessTypeProfile,
  signals: SignalMap,
  overrides: RuleParams = {},
): RuleOutcome | null {
  return rule.evaluate({
    profile,
    signals,
    location: testLocation,
    params: { ...rule.defaultParams, ...overrides },
  });
}
