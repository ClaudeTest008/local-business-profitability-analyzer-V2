import { describe, expect, it } from 'vitest';
import { round, saturating } from '@lboa/shared';
import { standardRuleSet } from './rule-set.js';
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
import { makeProfile, makeSignal, makeSignals, runRule } from './test-fixtures.js';

describe('signal-alignment', () => {
  it('rewards aligned signals and cites the strongest with values', () => {
    const profile = makeProfile({
      signalPreferences: [
        { signal: 'footTraffic', weight: 0.8, direction: 'higher_better' },
        { signal: 'medianIncomeTier', weight: 0.5, direction: 'target_range', idealRange: [2, 4] },
      ],
    });
    const signals = makeSignals(makeSignal('footTraffic', 100), makeSignal('medianIncomeTier', 3));
    const outcome = runRule(signalAlignment, profile, signals);
    expect(outcome).not.toBeNull();
    expect(outcome?.target).toBe('opportunity');
    expect(outcome?.contribution).toBeGreaterThan(0);
    expect(outcome?.contribution).toBeLessThanOrEqual(25);
    expect(outcome?.rationale).toContain('medianIncomeTier at tier 3 of 5');
    expect(outcome?.rationale).toContain('footTraffic at 100/100');
    expect(outcome?.evidenceIds).toEqual(['ev_footTraffic', 'ev_medianIncomeTier']);
  });

  it('scores a perfect target_range hit at maxPoints', () => {
    const profile = makeProfile({
      signalPreferences: [
        { signal: 'medianIncomeTier', weight: 1, direction: 'target_range', idealRange: [2, 4] },
      ],
    });
    const outcome = runRule(
      signalAlignment,
      profile,
      makeSignals(makeSignal('medianIncomeTier', 3)),
    );
    expect(outcome?.contribution).toBe(25);
  });

  it('treats lower_better zero-value as perfect alignment', () => {
    const profile = makeProfile({
      signalPreferences: [{ signal: 'vacancyRate', weight: 1, direction: 'lower_better' }],
    });
    const outcome = runRule(signalAlignment, profile, makeSignals(makeSignal('vacancyRate', 0)));
    expect(outcome?.contribution).toBe(25);
  });

  it('respects an explicit saturationValue over the unit-default knee', () => {
    const profile = makeProfile({
      signalPreferences: [
        { signal: 'footTraffic', weight: 1, direction: 'higher_better', saturationValue: 10 },
      ],
    });
    const outcome = runRule(signalAlignment, profile, makeSignals(makeSignal('footTraffic', 30)));
    expect(outcome?.contribution).toBe(round(25 * saturating(30, 10), 4));
  });

  it('returns null when no alignment reaches 0.5', () => {
    const profile = makeProfile(); // footTraffic higher_better, knee 50
    expect(runRule(signalAlignment, profile, makeSignals(makeSignal('footTraffic', 5)))).toBeNull();
  });

  it('returns null when preferred signals are absent', () => {
    expect(runRule(signalAlignment, makeProfile(), makeSignals())).toBeNull();
  });
});

describe('signal-misfit', () => {
  it('penalizes misaligned signals with full strength at alignment 0', () => {
    const profile = makeProfile({
      signalPreferences: [{ signal: 'footTraffic', weight: 1, direction: 'higher_better' }],
    });
    const outcome = runRule(signalMisfit, profile, makeSignals(makeSignal('footTraffic', 0)));
    expect(outcome?.contribution).toBe(-20);
    expect(outcome?.target).toBe('opportunity');
    expect(outcome?.rationale).toContain('footTraffic at 0/100 (alignment 0)');
    expect(outcome?.evidenceIds).toEqual(['ev_footTraffic']);
  });

  it('penalizes values outside a target_range with linear falloff', () => {
    const profile = makeProfile({
      signalPreferences: [
        { signal: 'medianIncomeTier', weight: 1, direction: 'target_range', idealRange: [2, 4] },
      ],
    });
    // width 2, distance 4 above → alignment 0 → misfit strength 1
    const outcome = runRule(signalMisfit, profile, makeSignals(makeSignal('medianIncomeTier', 8)));
    expect(outcome?.contribution).toBe(-20);
  });

  it('returns null when all present signals are aligned', () => {
    expect(
      runRule(signalMisfit, makeProfile(), makeSignals(makeSignal('footTraffic', 100))),
    ).toBeNull();
  });

  it('returns null when preferred signals are absent', () => {
    expect(runRule(signalMisfit, makeProfile(), makeSignals())).toBeNull();
  });
});

describe('market-gap', () => {
  it('fires on zero competitors in an active area, citing both values', () => {
    const signals = makeSignals(makeSignal('competitorCount', 0), makeSignal('poiDensity', 62.5));
    const outcome = runRule(marketGap, makeProfile(), signals);
    expect(outcome?.contribution).toBe(10);
    expect(outcome?.rationale).toContain('0 found');
    expect(outcome?.rationale).toContain('62.5 POIs/km²');
    expect(outcome?.evidenceIds).toEqual(['ev_competitorCount', 'ev_poiDensity']);
  });

  it('returns null when competitors exist', () => {
    const signals = makeSignals(makeSignal('competitorCount', 2), makeSignal('poiDensity', 62.5));
    expect(runRule(marketGap, makeProfile(), signals)).toBeNull();
  });

  it('returns null when the area is not active enough', () => {
    const signals = makeSignals(makeSignal('competitorCount', 0), makeSignal('poiDensity', 30));
    expect(runRule(marketGap, makeProfile(), signals)).toBeNull();
  });

  it('returns null when either signal is missing', () => {
    expect(
      runRule(marketGap, makeProfile(), makeSignals(makeSignal('competitorCount', 0))),
    ).toBeNull();
    expect(
      runRule(marketGap, makeProfile(), makeSignals(makeSignal('poiDensity', 62.5))),
    ).toBeNull();
  });
});

describe('synergy-presence', () => {
  it('rewards complementary businesses with diminishing returns', () => {
    const outcome = runRule(
      synergyPresence,
      makeProfile(),
      makeSignals(makeSignal('complementaryCount', 4)),
    );
    expect(outcome?.contribution).toBe(round(8 * saturating(4, 4), 4));
    expect(outcome?.rationale).toContain('4 complementary businesses');
  });

  it('returns null at zero complementary businesses or missing signal', () => {
    expect(
      runRule(synergyPresence, makeProfile(), makeSignals(makeSignal('complementaryCount', 0))),
    ).toBeNull();
    expect(runRule(synergyPresence, makeProfile(), makeSignals())).toBeNull();
  });
});

describe('competitor-saturation', () => {
  const signals = makeSignals(
    makeSignal('competitorCount', 7),
    makeSignal('competitorDensity', 2.8),
  );

  it('penalizes density scaled by competition sensitivity, citing values', () => {
    const outcome = runRule(
      competitorSaturation,
      makeProfile({ competitionSensitivity: 0.8 }),
      signals,
    );
    expect(outcome?.contribution).toBe(round(-25 * saturating(2.8, 8) * 0.8, 4));
    expect(outcome?.rationale).toContain('7 competitors (2.8/km²)');
    expect(outcome?.rationale).toContain('80% sensitive');
    expect(outcome?.target).toBe('opportunity');
  });

  it('returns null without at least one competitor', () => {
    const zero = makeSignals(makeSignal('competitorCount', 0), makeSignal('competitorDensity', 0));
    expect(runRule(competitorSaturation, makeProfile(), zero)).toBeNull();
  });

  it('returns null when density is missing', () => {
    expect(
      runRule(competitorSaturation, makeProfile(), makeSignals(makeSignal('competitorCount', 7))),
    ).toBeNull();
  });
});

describe('population-floor', () => {
  const profile = makeProfile({ minViablePopulationDensity: 500 });

  it('disqualifies below the floor with contribution 0, citing both numbers', () => {
    const outcome = runRule(
      populationFloor,
      profile,
      makeSignals(makeSignal('populationDensity', 350)),
    );
    expect(outcome?.kind).toBe('disqualifier');
    expect(outcome?.contribution).toBe(0);
    expect(outcome?.rationale).toContain('350/km²');
    expect(outcome?.rationale).toContain('500/km²');
    expect(outcome?.evidenceIds).toEqual(['ev_populationDensity']);
  });

  it('does NOT fire when the signal is absent (gap → confidence, not disqualification)', () => {
    expect(runRule(populationFloor, profile, makeSignals())).toBeNull();
  });

  it('returns null at or above the floor', () => {
    expect(
      runRule(populationFloor, profile, makeSignals(makeSignal('populationDensity', 500))),
    ).toBeNull();
  });

  it('returns null when the profile has no floor', () => {
    const noFloor = makeProfile({ minViablePopulationDensity: 0 });
    expect(
      runRule(populationFloor, noFloor, makeSignals(makeSignal('populationDensity', 1))),
    ).toBeNull();
  });
});

describe('vacancy-climate', () => {
  it('applies linear severity between threshold and max rate', () => {
    // (0.32 - 0.25) / (0.6 - 0.25) = 0.2 → -2
    const outcome = runRule(
      vacancyClimate,
      makeProfile(),
      makeSignals(makeSignal('vacancyRate', 0.32)),
    );
    expect(outcome?.contribution).toBe(-2);
    expect(outcome?.rationale).toContain('32%');
    expect(outcome?.rationale).toContain('25%');
  });

  it('caps at full penalty above the max rate', () => {
    const outcome = runRule(
      vacancyClimate,
      makeProfile(),
      makeSignals(makeSignal('vacancyRate', 0.7)),
    );
    expect(outcome?.contribution).toBe(-10);
  });

  it('returns null at or below the threshold, or when absent', () => {
    expect(
      runRule(vacancyClimate, makeProfile(), makeSignals(makeSignal('vacancyRate', 0.25))),
    ).toBeNull();
    expect(runRule(vacancyClimate, makeProfile(), makeSignals())).toBeNull();
  });
});

describe('rent-pressure', () => {
  it('fires for high rent + capital-intensive profile', () => {
    const outcome = runRule(
      rentPressure,
      makeProfile({ capitalIntensity: 3 }),
      makeSignals(makeSignal('rentTier', 4)),
    );
    expect(outcome?.contribution).toBe(-8);
    expect(outcome?.rationale).toContain('tier 4 of 5');
    expect(outcome?.rationale).toContain('3 of 5');
  });

  it('returns null below either minimum or when rentTier is missing', () => {
    expect(
      runRule(
        rentPressure,
        makeProfile({ capitalIntensity: 3 }),
        makeSignals(makeSignal('rentTier', 3)),
      ),
    ).toBeNull();
    expect(
      runRule(
        rentPressure,
        makeProfile({ capitalIntensity: 2 }),
        makeSignals(makeSignal('rentTier', 4)),
      ),
    ).toBeNull();
    expect(runRule(rentPressure, makeProfile({ capitalIntensity: 3 }), makeSignals())).toBeNull();
  });
});

describe('accessibility-bonus', () => {
  it('fires when infra clears the threshold and the profile weights foot traffic', () => {
    const outcome = runRule(
      accessibilityBonus,
      makeProfile(),
      makeSignals(makeSignal('pedestrianInfra', 72)),
    );
    expect(outcome?.contribution).toBe(5);
    expect(outcome?.rationale).toContain('72/100');
    expect(outcome?.rationale).toContain('0.8');
  });

  it('returns null below the threshold', () => {
    expect(
      runRule(accessibilityBonus, makeProfile(), makeSignals(makeSignal('pedestrianInfra', 50))),
    ).toBeNull();
  });

  it('returns null when the profile barely cares about foot traffic', () => {
    const lowFoot = makeProfile({
      signalPreferences: [{ signal: 'footTraffic', weight: 0.3, direction: 'higher_better' }],
    });
    expect(
      runRule(accessibilityBonus, lowFoot, makeSignals(makeSignal('pedestrianInfra', 72))),
    ).toBeNull();
  });

  it('returns null without a footTraffic preference', () => {
    const noFoot = makeProfile({
      signalPreferences: [{ signal: 'visibility', weight: 1, direction: 'higher_better' }],
    });
    expect(
      runRule(accessibilityBonus, noFoot, makeSignals(makeSignal('pedestrianInfra', 72))),
    ).toBeNull();
  });
});

describe('rural-context', () => {
  it('penalizes foot-traffic-dependent profiles in rural areas', () => {
    const outcome = runRule(
      ruralContext,
      makeProfile(),
      makeSignals(makeSignal('urbanization', 22)),
    );
    expect(outcome?.contribution).toBe(-8);
    expect(outcome?.kind).toBe('context_overlay');
    expect(outcome?.rationale).toContain('22/100');
    expect(outcome?.rationale).toContain('0.8');
    expect(outcome?.evidenceIds).toEqual(['ev_urbanization']);
  });

  it('rewards destination-tagged profiles with good road access', () => {
    const destination = makeProfile({
      signalPreferences: [{ signal: 'footTraffic', weight: 0.4, direction: 'higher_better' }],
      tags: ['destination'],
    });
    const signals = makeSignals(makeSignal('urbanization', 22), makeSignal('roadAccess', 65));
    const outcome = runRule(ruralContext, destination, signals);
    expect(outcome?.contribution).toBe(5);
    expect(outcome?.rationale).toContain('65/100');
    expect(outcome?.evidenceIds).toEqual(['ev_urbanization', 'ev_roadAccess']);
  });

  it('returns null in non-rural areas or when urbanization is absent', () => {
    expect(
      runRule(ruralContext, makeProfile(), makeSignals(makeSignal('urbanization', 40))),
    ).toBeNull();
    expect(runRule(ruralContext, makeProfile(), makeSignals())).toBeNull();
  });

  it('returns null for a non-destination, non-foot-traffic profile', () => {
    const neutral = makeProfile({
      signalPreferences: [{ signal: 'footTraffic', weight: 0.4, direction: 'higher_better' }],
    });
    const signals = makeSignals(makeSignal('urbanization', 22), makeSignal('roadAccess', 65));
    expect(runRule(ruralContext, neutral, signals)).toBeNull();
  });

  it('returns null for a destination profile with poor road access', () => {
    const destination = makeProfile({
      signalPreferences: [{ signal: 'footTraffic', weight: 0.4, direction: 'higher_better' }],
      tags: ['destination'],
    });
    const signals = makeSignals(makeSignal('urbanization', 22), makeSignal('roadAccess', 50));
    expect(runRule(ruralContext, destination, signals)).toBeNull();
  });
});

describe('capital-exposure', () => {
  it('adds risk per capital intensity level', () => {
    const outcome = runRule(capitalExposure, makeProfile({ capitalIntensity: 4 }), makeSignals());
    expect(outcome?.contribution).toBe(20);
    expect(outcome?.target).toBe('risk');
    expect(outcome?.rationale).toContain('4 of 5');
    expect(outcome?.rationale).toContain('20');
    expect(outcome?.evidenceIds).toEqual([]);
  });
});

describe('operational-complexity', () => {
  it('adds risk per complexity level', () => {
    const outcome = runRule(
      operationalComplexity,
      makeProfile({ operationalComplexity: 3 }),
      makeSignals(),
    );
    expect(outcome?.contribution).toBe(9);
    expect(outcome?.target).toBe('risk');
    expect(outcome?.rationale).toContain('3 of 5');
  });
});

describe('competition-risk', () => {
  const signals = makeSignals(
    makeSignal('competitorCount', 7),
    makeSignal('competitorDensity', 2.8),
  );

  it('adds sensitivity-scaled risk from competitor density', () => {
    const outcome = runRule(competitionRisk, makeProfile({ competitionSensitivity: 0.8 }), signals);
    expect(outcome?.contribution).toBe(round(20 * saturating(2.8, 8) * 0.8, 4));
    expect(outcome?.target).toBe('risk');
    expect(outcome?.rationale).toContain('7 competitors at 2.8/km²');
    expect(outcome?.rationale).toContain('0.8');
  });

  it('returns null without competitors or density', () => {
    expect(
      runRule(
        competitionRisk,
        makeProfile(),
        makeSignals(makeSignal('competitorCount', 0), makeSignal('competitorDensity', 0)),
      ),
    ).toBeNull();
    expect(
      runRule(competitionRisk, makeProfile(), makeSignals(makeSignal('competitorCount', 7))),
    ).toBeNull();
  });
});

describe('vacancy-risk', () => {
  it('scales risk against the max rate', () => {
    const outcome = runRule(
      vacancyRisk,
      makeProfile(),
      makeSignals(makeSignal('vacancyRate', 0.3)),
    );
    expect(outcome?.contribution).toBe(9); // 15 * 0.3/0.5
    expect(outcome?.rationale).toContain('30%');
  });

  it('caps at maxPoints', () => {
    const outcome = runRule(
      vacancyRisk,
      makeProfile(),
      makeSignals(makeSignal('vacancyRate', 0.8)),
    );
    expect(outcome?.contribution).toBe(15);
  });

  it('returns null when the signal is absent', () => {
    expect(runRule(vacancyRisk, makeProfile(), makeSignals())).toBeNull();
  });
});

describe('demand-fragility', () => {
  const profile = makeProfile({ minViablePopulationDensity: 500 });

  it('fires between 1x and 1.5x of the floor', () => {
    const outcome = runRule(
      demandFragility,
      profile,
      makeSignals(makeSignal('populationDensity', 600)),
    );
    expect(outcome?.contribution).toBe(10);
    expect(outcome?.rationale).toContain('600/km²');
    expect(outcome?.rationale).toContain('500/km²');
  });

  it('includes both boundaries', () => {
    expect(
      runRule(demandFragility, profile, makeSignals(makeSignal('populationDensity', 500)))
        ?.contribution,
    ).toBe(10);
    expect(
      runRule(demandFragility, profile, makeSignals(makeSignal('populationDensity', 750)))
        ?.contribution,
    ).toBe(10);
  });

  it('returns null outside the fragile band, without a floor, or when absent', () => {
    expect(
      runRule(demandFragility, profile, makeSignals(makeSignal('populationDensity', 400))),
    ).toBeNull();
    expect(
      runRule(demandFragility, profile, makeSignals(makeSignal('populationDensity', 800))),
    ).toBeNull();
    expect(
      runRule(demandFragility, makeProfile(), makeSignals(makeSignal('populationDensity', 600))),
    ).toBeNull();
    expect(runRule(demandFragility, profile, makeSignals())).toBeNull();
  });
});

describe('income-mismatch', () => {
  it('fires on low income + high rent', () => {
    const signals = makeSignals(makeSignal('medianIncomeTier', 2), makeSignal('rentTier', 4));
    const outcome = runRule(incomeMismatch, makeProfile(), signals);
    expect(outcome?.contribution).toBe(12);
    expect(outcome?.rationale).toContain('tier 2 of 5');
    expect(outcome?.rationale).toContain('tier 4 of 5');
    expect(outcome?.evidenceIds).toEqual(['ev_medianIncomeTier', 'ev_rentTier']);
  });

  it('returns null when income or rent do not qualify, or a signal is missing', () => {
    expect(
      runRule(
        incomeMismatch,
        makeProfile(),
        makeSignals(makeSignal('medianIncomeTier', 3), makeSignal('rentTier', 4)),
      ),
    ).toBeNull();
    expect(
      runRule(
        incomeMismatch,
        makeProfile(),
        makeSignals(makeSignal('medianIncomeTier', 2), makeSignal('rentTier', 3)),
      ),
    ).toBeNull();
    expect(
      runRule(incomeMismatch, makeProfile(), makeSignals(makeSignal('rentTier', 4))),
    ).toBeNull();
  });
});

describe('low-signal-quality', () => {
  const profile = makeProfile({ requiredSignals: ['footTraffic', 'poiDensity'] });

  it('lowers confidence when mean quality of present required signals is low', () => {
    const signals = makeSignals(
      makeSignal('footTraffic', 80, 0.3),
      makeSignal('poiDensity', 50, 0.4),
    );
    const outcome = runRule(lowSignalQuality, profile, signals);
    expect(outcome?.contribution).toBe(-0.1);
    expect(outcome?.target).toBe('confidence');
    expect(outcome?.rationale).toContain('0.35');
    expect(outcome?.rationale).toContain('2 present required signals');
    expect(outcome?.evidenceIds).toEqual(['ev_footTraffic', 'ev_poiDensity']);
  });

  it('returns null on good quality or when no required signal is present', () => {
    const good = makeSignals(makeSignal('footTraffic', 80, 0.9), makeSignal('poiDensity', 50, 0.9));
    expect(runRule(lowSignalQuality, profile, good)).toBeNull();
    expect(runRule(lowSignalQuality, profile, makeSignals())).toBeNull();
  });
});

describe('standard rule set invariants', () => {
  it('contains all 20 rules with unique ids and complete metadata', () => {
    expect(standardRuleSet.id).toBe('standard');
    expect(standardRuleSet.version).toBe('1.1.0');
    expect(standardRuleSet.rules).toHaveLength(20);
    expect(new Set(standardRuleSet.rules.map((r) => r.id)).size).toBe(20);
    for (const rule of standardRuleSet.rules) {
      expect(rule.version).toBe('1.0.0');
      expect(rule.description.length).toBeGreaterThan(0);
      expect(rule.defaultParams).toBeTypeOf('object');
    }
  });

  it('maps every kind to the correct score target', () => {
    for (const rule of standardRuleSet.rules) {
      const expected =
        rule.kind === 'risk'
          ? 'risk'
          : rule.kind === 'confidence_adjustment'
            ? 'confidence'
            : 'opportunity';
      expect(rule.target, rule.id).toBe(expected);
    }
  });
});
