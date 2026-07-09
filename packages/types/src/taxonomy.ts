import { z } from 'zod';
import { signalKeySchema } from './signal.js';

export const signalPreferenceSchema = z.object({
  signal: signalKeySchema,
  /** Relative importance for this business type, 0–1. */
  weight: z.number().min(0).max(1),
  direction: z.enum(['higher_better', 'lower_better', 'target_range']),
  /** Required when direction is target_range; in the signal's canonical unit. */
  idealRange: z.tuple([z.number(), z.number()]).optional(),
  /** Value at which additional signal stops helping (diminishing returns knee). */
  saturationValue: z.number().positive().optional(),
});
export type SignalPreference = z.infer<typeof signalPreferenceSchema>;

export const categorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string(),
});
export type Category = z.infer<typeof categorySchema>;

export const subcategorySchema = categorySchema.extend({
  categoryId: z.string().regex(/^[a-z0-9-]+$/),
});
export type Subcategory = z.infer<typeof subcategorySchema>;

export const businessTypeProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  categoryId: z.string(),
  subcategoryId: z.string(),
  description: z.string(),
  /** How location signals affect this business. Weights need not sum to 1. */
  signalPreferences: z.array(signalPreferenceSchema).min(1),
  /** Signals that must be present for a confident verdict (missing → gap → lower confidence). */
  requiredSignals: z.array(signalKeySchema).min(1),
  /** 0–1: how badly same-type competition hurts (1 = winner-takes-all local market). */
  competitionSensitivity: z.number().min(0).max(1),
  /** Business type ids whose presence nearby feeds this one customers. */
  synergyTypeIds: z.array(z.string()),
  /** Business type ids that compete for the same demand beyond exact same-type. */
  rivalTypeIds: z.array(z.string()),
  /** Minimum residents/km² for viability; 0 = no floor (e.g. destination businesses). */
  minViablePopulationDensity: z.number().min(0),
  /** 1 (kiosk) … 5 (hospital-grade capex). Feeds Risk, never Opportunity. */
  capitalIntensity: z.number().int().min(1).max(5),
  /** 1 (simple retail) … 5 (heavily regulated / skilled staff). Feeds Risk. */
  operationalComplexity: z.number().int().min(1).max(5),
  /** OpenStreetMap tags identifying same-type competitors, e.g. ['amenity=cafe']. */
  osmTags: z.array(z.string()),
  tags: z.array(z.string()),
});
export type BusinessTypeProfile = z.infer<typeof businessTypeProfileSchema>;

export interface Taxonomy {
  version: string;
  categories: Category[];
  subcategories: Subcategory[];
  businessTypes: BusinessTypeProfile[];
}
