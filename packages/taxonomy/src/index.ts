import type { BusinessTypeProfile, Taxonomy } from '@lboa/types';
import { categories } from './categories.js';
import { subcategories } from './subcategories.js';
import { foodDrinkTypes } from './business-types/food-drink.js';
import { retailTypes } from './business-types/retail.js';
import { healthWellnessTypes } from './business-types/health-wellness.js';
import { personalServicesTypes } from './business-types/personal-services.js';
import { educationTypes } from './business-types/education.js';
import { entertainmentLeisureTypes } from './business-types/entertainment-leisure.js';
import { automotiveTypes } from './business-types/automotive.js';
import { hospitalityTypes } from './business-types/hospitality.js';
import { professionalServicesTypes } from './business-types/professional-services.js';
import { homeConstructionTypes } from './business-types/home-construction.js';
import { petsTypes } from './business-types/pets.js';
import { fitnessSportsTypes } from './business-types/fitness-sports.js';

export const TAXONOMY_VERSION = '1.0.0';

const businessTypes: BusinessTypeProfile[] = [
  ...foodDrinkTypes,
  ...retailTypes,
  ...healthWellnessTypes,
  ...personalServicesTypes,
  ...educationTypes,
  ...entertainmentLeisureTypes,
  ...automotiveTypes,
  ...hospitalityTypes,
  ...professionalServicesTypes,
  ...homeConstructionTypes,
  ...petsTypes,
  ...fitnessSportsTypes,
];

export const taxonomy: Taxonomy = {
  version: TAXONOMY_VERSION,
  categories,
  subcategories,
  businessTypes,
};

const byId = new Map(businessTypes.map((bt) => [bt.id, bt]));

export function getBusinessType(id: string): BusinessTypeProfile | undefined {
  return byId.get(id);
}

export function getBusinessTypesByCategory(categoryId: string): BusinessTypeProfile[] {
  return businessTypes.filter((bt) => bt.categoryId === categoryId);
}

/** Maps every businessTypeId to its osmTags; used by @lboa/evidence to count competitors/synergies. */
export function resolveOsmTagsByTypeId(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const bt of businessTypes) out[bt.id] = bt.osmTags;
  return out;
}

export { validateTaxonomy } from './validate.js';
export { categories } from './categories.js';
export { subcategories } from './subcategories.js';
