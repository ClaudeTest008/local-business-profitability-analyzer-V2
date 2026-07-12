import { useMemo, useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import type { AnalysisResult, Verdict } from '@lboa/types';
import { Button, Card, EmptyState, RecommendationCard, Screen } from '@lboa/ui';
import { getAnalysis } from '../../../src/lib/db';
import { useApi } from '../../../src/lib/hooks';
import {
  formatCoords,
  formatDate,
  formatRadius,
  providerFreshnessLabel,
} from '../../../src/lib/format';

const VERDICT_FILTERS: Array<Verdict | 'all'> = ['all', 'recommended', 'viable', 'marginal'];

function summaryHtml(result: AnalysisResult): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const top = result.recommendations.slice(0, 10);
  const gaps = result.evidence.filter((e) => e.kind === 'gap');
  const assumptions = result.evidence.filter((e) => e.kind === 'assumption');
  return `<html><body style="font-family:-apple-system,sans-serif;padding:24px">
  <h1>Location Analysis</h1>
  <p>${formatCoords(result.request.location.point.lat, result.request.location.point.lon)},
     radius ${formatRadius(result.request.location.radiusM)} — ${esc(formatDate(result.createdAt))}</p>
  <p>Engine ${esc(result.engineVersion)} · rules ${esc(result.ruleSetVersion)} · taxonomy ${esc(result.taxonomyVersion)}</p>
  <h2>Top opportunities</h2>
  <table border="1" cellpadding="6" cellspacing="0" width="100%">
    <tr><th>#</th><th>Business</th><th>Opportunity</th><th>Risk</th><th>Confidence</th></tr>
    ${top
      .map(
        (r) =>
          `<tr><td>${r.rank}</td><td>${esc(r.businessTypeName)}</td><td>${r.scores.opportunity}/100</td><td>${r.scores.risk}/100</td><td>${Math.round(r.scores.confidence * 100)}%</td></tr>`,
      )
      .join('')}
  </table>
  <h2>Assumptions (${assumptions.length})</h2>
  <ul>${assumptions.map((a) => `<li>${esc(a.summary)}</li>`).join('') || '<li>None</li>'}</ul>
  <h2>Data gaps (${gaps.length})</h2>
  <ul>${gaps.map((g) => `<li>${esc(g.summary)}</li>`).join('') || '<li>None</li>'}</ul>
  <p style="color:#666">Scores are deterministic and rule-based. Opportunity, Risk and Confidence
  are separate measures and are never combined.</p>
  </body></html>`;
}

export default function AnalysisResults() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const [search, setSearch] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<Verdict | 'all'>('all');
  const [showDisqualified, setShowDisqualified] = useState(false);

  const query = useQuery({
    queryKey: ['analysis', id],
    queryFn: async () => (await getAnalysis(id)) ?? api.getAnalysis(id),
  });

  const result = query.data;
  const filtered = useMemo(() => {
    if (!result) return [];
    const q = search.trim().toLowerCase();
    return result.recommendations.filter(
      (r) =>
        (verdictFilter === 'all' || r.explanation.verdict === verdictFilter) &&
        (q === '' || r.businessTypeName.toLowerCase().includes(q)),
    );
  }, [result, search, verdictFilter]);

  if (!result) {
    return (
      <Screen>
        <EmptyState
          title={query.isLoading ? 'Loading analysis…' : 'Analysis not found'}
          hint={query.isError ? 'Not cached locally and the server is unreachable.' : undefined}
        />
      </Screen>
    );
  }

  const exportPdf = async () => {
    const { uri } = await Print.printToFileAsync({ html: summaryHtml(result) });
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
  };

  const exportCsv = async () => {
    const csv = await api.reportCsv(result.id);
    const file = new File(Paths.cache, `analysis-${result.id}.csv`);
    file.write(csv);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' });
  };

  return (
    <Screen>
      <Card>
        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {formatCoords(result.request.location.point.lat, result.request.location.point.lon)} ·{' '}
          {formatRadius(result.request.location.radiusM)} · {formatDate(result.createdAt)}
        </Text>
        {result.providerStatuses.map((p) => (
          <Text
            key={p.providerId}
            className={`text-xs ${p.status === 'stale_cache' || p.status === 'failure' ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-500 dark:text-neutral-400'}`}
          >
            {p.providerId}: {providerFreshnessLabel(p.status, p.fetchedAt)}
          </Text>
        ))}
        <View className="mt-2 flex-row gap-2">
          <View className="flex-1">
            <Button label="PDF" tone="secondary" onPress={() => void exportPdf()} />
          </View>
          <View className="flex-1">
            <Button label="CSV" tone="secondary" onPress={() => void exportCsv()} />
          </View>
          <View className="flex-1">
            <Button
              label="Evidence"
              tone="secondary"
              onPress={() => router.push(`/analysis/${result.id}/evidence`)}
            />
          </View>
          <View className="flex-1">
            <Button
              label="What-if"
              tone="secondary"
              onPress={() => router.push(`/analysis/${result.id}/scenario`)}
            />
          </View>
        </View>
      </Card>

      <TextInput
        className="mb-2 min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
        placeholder="Search business types…"
        placeholderTextColor="#737373"
        value={search}
        onChangeText={setSearch}
        accessibilityLabel="Search business types"
      />
      <View className="mb-2 flex-row gap-2">
        {VERDICT_FILTERS.map((v) => (
          <View key={v} className="flex-1">
            <Button
              label={v === 'all' ? 'All' : v.replace('_', ' ')}
              tone={verdictFilter === v ? 'primary' : 'secondary'}
              onPress={() => setVerdictFilter(v)}
            />
          </View>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.businessTypeId}
        initialNumToRender={10}
        renderItem={({ item }) => (
          <RecommendationCard
            name={item.businessTypeName}
            category={item.categoryId}
            rank={item.rank}
            verdict={item.explanation.verdict}
            opportunity={item.scores.opportunity}
            risk={item.scores.risk}
            confidence={item.scores.confidence}
            headline={item.explanation.headline}
            onPress={() => router.push(`/analysis/${result.id}/type/${item.businessTypeId}`)}
          />
        )}
        ListEmptyComponent={<EmptyState title="No matches" hint="Adjust filters or search." />}
        ListFooterComponent={
          <View className="mb-8">
            <Button
              label={`${showDisqualified ? 'Hide' : 'Show'} disqualified (${result.disqualified.length})`}
              tone="secondary"
              onPress={() => setShowDisqualified((s) => !s)}
            />
            {showDisqualified
              ? result.disqualified.map((d) => (
                  <Card key={d.businessTypeId}>
                    <Text className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {d.businessTypeName}
                    </Text>
                    {d.disqualifiedBy.map((o) => (
                      <Text key={o.ruleId} className="text-sm text-rose-700 dark:text-rose-400">
                        {o.rationale}
                      </Text>
                    ))}
                  </Card>
                ))
              : null}
          </View>
        }
      />
    </Screen>
  );
}
