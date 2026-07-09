import type { AnalysisRequest, BusinessTypeProfile, Taxonomy } from '@lboa/types';

/** Deterministic selection of the business types to evaluate for a request. */
export function selectBusinessTypes(
  taxonomy: Taxonomy,
  request: AnalysisRequest,
): BusinessTypeProfile[] {
  const byId = request.businessTypeIds?.length ? new Set(request.businessTypeIds) : undefined;
  const byCategory = request.categoryIds?.length ? new Set(request.categoryIds) : undefined;
  return taxonomy.businessTypes
    .filter((p) => (byId ? byId.has(p.id) : true))
    .filter((p) => (byCategory ? byCategory.has(p.categoryId) : true))
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
