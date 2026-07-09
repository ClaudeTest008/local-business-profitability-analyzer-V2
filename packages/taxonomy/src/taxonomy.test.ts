import { describe, expect, it } from 'vitest';
import { businessTypeProfileSchema } from '@lboa/types';
import {
  getBusinessType,
  getBusinessTypesByCategory,
  resolveOsmTagsByTypeId,
  taxonomy,
  TAXONOMY_VERSION,
  validateTaxonomy,
} from './index.js';

describe('taxonomy dataset', () => {
  it('meets minimum size requirements', () => {
    expect(taxonomy.businessTypes.length).toBeGreaterThanOrEqual(200);
    expect(taxonomy.categories.length).toBeGreaterThanOrEqual(12);
    expect(taxonomy.subcategories.length).toBeGreaterThanOrEqual(35);
    expect(taxonomy.version).toBe(TAXONOMY_VERSION);
  });

  it('passes validateTaxonomy with no violations', () => {
    expect(validateTaxonomy(taxonomy)).toEqual([]);
  });

  it('every profile parses with businessTypeProfileSchema', () => {
    for (const bt of taxonomy.businessTypes) {
      const result = businessTypeProfileSchema.safeParse(bt);
      expect(
        result.success,
        `profile "${bt.id}" failed schema: ${result.success ? '' : result.error.message}`,
      ).toBe(true);
    }
  });

  it('resolveOsmTagsByTypeId covers every business type with non-empty tags', () => {
    const map = resolveOsmTagsByTypeId();
    for (const bt of taxonomy.businessTypes) {
      expect(map[bt.id], `missing osm tags for "${bt.id}"`).toBeDefined();
      expect(map[bt.id]!.length).toBeGreaterThan(0);
    }
    expect(Object.keys(map).length).toBe(taxonomy.businessTypes.length);
  });

  it('all ids are kebab-case and unique', () => {
    const kebab = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    const allIds = [
      ...taxonomy.categories.map((c) => c.id),
      ...taxonomy.subcategories.map((s) => s.id),
      ...taxonomy.businessTypes.map((b) => b.id),
    ];
    for (const id of allIds) expect(id, `id "${id}" is not kebab-case`).toMatch(kebab);
    const typeIds = taxonomy.businessTypes.map((b) => b.id);
    expect(new Set(typeIds).size).toBe(typeIds.length);
  });

  it('helpers look up types and categories', () => {
    expect(getBusinessType('coffee-shop')?.name).toBe('Coffee Shop');
    expect(getBusinessType('does-not-exist')).toBeUndefined();
    const foodDrink = getBusinessTypesByCategory('food-drink');
    expect(foodDrink.length).toBeGreaterThanOrEqual(30);
    expect(foodDrink.every((bt) => bt.categoryId === 'food-drink')).toBe(true);
  });

  it('validateTaxonomy reports dangling references and bad preferences', () => {
    const broken = {
      ...taxonomy,
      businessTypes: [
        {
          ...taxonomy.businessTypes[0]!,
          id: 'broken-type',
          synergyTypeIds: ['ghost-type'],
          rivalTypeIds: ['other-ghost'],
          signalPreferences: [
            { signal: 'footTraffic' as const, weight: 1.5, direction: 'higher_better' as const },
            { signal: 'urbanization' as const, weight: 0.5, direction: 'target_range' as const },
          ],
        },
      ],
    };
    const errors = validateTaxonomy(broken);
    expect(errors.some((e) => e.includes('unknown synergyTypeId "ghost-type"'))).toBe(true);
    expect(errors.some((e) => e.includes('unknown rivalTypeId "other-ghost"'))).toBe(true);
    expect(errors.some((e) => e.includes('weight 1.5 outside [0,1]'))).toBe(true);
    expect(errors.some((e) => e.includes('target_range but has no idealRange'))).toBe(true);
  });
});
