import type { Taxonomy } from '@lboa/types';

/** Returns human-readable violations; empty array = valid taxonomy. */
export function validateTaxonomy(t: Taxonomy): string[] {
  const errors: string[] = [];

  const collectIds = (label: string, ids: string[]): Set<string> => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`duplicate ${label} id "${id}"`);
      seen.add(id);
    }
    return seen;
  };

  const categoryIds = collectIds(
    'category',
    t.categories.map((c) => c.id),
  );
  const subcategoryIds = collectIds(
    'subcategory',
    t.subcategories.map((s) => s.id),
  );
  const typeIds = collectIds(
    'business type',
    t.businessTypes.map((b) => b.id),
  );

  for (const sub of t.subcategories) {
    if (!categoryIds.has(sub.categoryId)) {
      errors.push(`subcategory "${sub.id}" references unknown categoryId "${sub.categoryId}"`);
    }
  }

  for (const bt of t.businessTypes) {
    if (!categoryIds.has(bt.categoryId)) {
      errors.push(`business type "${bt.id}" references unknown categoryId "${bt.categoryId}"`);
    }
    if (!subcategoryIds.has(bt.subcategoryId)) {
      errors.push(
        `business type "${bt.id}" references unknown subcategoryId "${bt.subcategoryId}"`,
      );
    }
    for (const ref of bt.synergyTypeIds) {
      if (!typeIds.has(ref))
        errors.push(`business type "${bt.id}" references unknown synergyTypeId "${ref}"`);
    }
    for (const ref of bt.rivalTypeIds) {
      if (!typeIds.has(ref))
        errors.push(`business type "${bt.id}" references unknown rivalTypeId "${ref}"`);
    }
    if (bt.osmTags.length === 0) errors.push(`business type "${bt.id}" has empty osmTags`);
    if (bt.requiredSignals.length === 0)
      errors.push(`business type "${bt.id}" has empty requiredSignals`);
    for (const p of bt.signalPreferences) {
      if (p.direction === 'target_range' && p.idealRange === undefined) {
        errors.push(
          `business type "${bt.id}" preference "${p.signal}" is target_range but has no idealRange`,
        );
      }
      if (p.weight < 0 || p.weight > 1) {
        errors.push(
          `business type "${bt.id}" preference "${p.signal}" has weight ${p.weight} outside [0,1]`,
        );
      }
    }
  }

  return errors;
}
