import type { FastifyInstance } from 'fastify';
import type { AnalysisResult } from '@lboa/types';
import type { AppCtx } from '../analysis-service.js';

/** RFC-4180 escaping: quote when the field contains a quote, comma, or newline. */
export function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

const CSV_HEADER =
  'rank,businessTypeId,name,category,verdict,opportunity,risk,confidence,topPositive,topNegative';

export function buildCsv(result: AnalysisResult): string {
  const lines = [CSV_HEADER];
  for (const r of result.recommendations) {
    lines.push(
      [
        r.rank,
        r.businessTypeId,
        r.businessTypeName,
        r.categoryId,
        r.explanation.verdict,
        r.scores.opportunity,
        r.scores.risk,
        r.scores.confidence,
        r.explanation.topPositives[0]?.rationale ?? '',
        r.explanation.topNegatives[0]?.rationale ?? '',
      ]
        .map(csvField)
        .join(','),
    );
  }
  for (const d of result.disqualified) {
    lines.push(
      [
        '',
        d.businessTypeId,
        d.businessTypeName,
        d.categoryId,
        d.explanation.verdict,
        '',
        '',
        '',
        d.explanation.topPositives[0]?.rationale ?? '',
        d.disqualifiedBy[0]?.rationale ?? '',
      ]
        .map(csvField)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function reportRoutes(ctx: AppCtx) {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get<{ Params: { id: string } }>('/analyses/:id/report.csv', async (req, reply) => {
      const record = await ctx.repo.analyses.get(req.params.id);
      if (!record) return reply.status(404).send({ error: 'not_found' });
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="analysis-${record.id}.csv"`)
        .send(buildCsv(record.result));
    });

    app.get<{ Params: { id: string } }>('/analyses/:id/summary', async (req, reply) => {
      const record = await ctx.repo.analyses.get(req.params.id);
      if (!record) return reply.status(404).send({ error: 'not_found' });
      const result = record.result;
      return {
        location: result.request.location,
        createdAt: result.createdAt,
        totalEvaluated: result.recommendations.length + result.disqualified.length,
        recommendedCount: result.recommendations.filter(
          (r) => r.explanation.verdict === 'recommended',
        ).length,
        disqualifiedCount: result.disqualified.length,
        top5: result.recommendations.slice(0, 5).map((r) => ({
          name: r.businessTypeName,
          opportunity: r.scores.opportunity,
          risk: r.scores.risk,
          confidence: r.scores.confidence,
          headline: r.explanation.headline,
        })),
        keyGaps: result.evidence.filter((e) => e.kind === 'gap').map((e) => e.summary),
        keyAssumptions: result.evidence
          .filter((e) => e.kind === 'assumption')
          .map((e) => e.summary),
        dataFreshness: result.providerStatuses,
      };
    });
  };
}
