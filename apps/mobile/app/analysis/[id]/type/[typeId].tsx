import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Svg, { Rect } from 'react-native-svg';
import type { ScoreBreakdownEntry } from '@lboa/types';
import {
  Card,
  ConfidenceMeter,
  EmptyState,
  Screen,
  ScoreBar,
  Section,
  VerdictPill,
} from '@lboa/ui';
import { getAnalysis } from '../../../../src/lib/db';
import { useApi } from '../../../../src/lib/hooks';

function Contribution({ entry, sign }: { entry: ScoreBreakdownEntry; sign: '+' | '' }) {
  const positive = entry.contribution >= 0;
  return (
    <View className="mb-2 border-b border-neutral-100 pb-2 dark:border-neutral-800">
      <View className="flex-row justify-between">
        <Text className="flex-1 text-xs text-neutral-500 dark:text-neutral-400">
          {entry.ruleId} v{entry.ruleVersion}
        </Text>
        <Text
          className={`text-sm font-bold ${positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}
        >
          {positive ? sign : ''}
          {Math.round(entry.contribution * 10) / 10}
        </Text>
      </View>
      <Text className="text-sm text-neutral-800 dark:text-neutral-200">{entry.rationale}</Text>
    </View>
  );
}

/** Confidence factor bars — values always printed as text next to the bar. */
function FactorBar({ label, value, max = 1 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View
      className="mb-2"
      accessible
      accessibilityLabel={`${label}: ${Math.round(pct * 100)} percent`}
    >
      <View className="flex-row justify-between">
        <Text className="text-xs text-neutral-600 dark:text-neutral-400">{label}</Text>
        <Text className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
          {Math.round(pct * 100)}%
        </Text>
      </View>
      <Svg height={8} width="100%">
        <Rect x={0} y={0} width="100%" height={8} rx={4} fill="#d4d4d4" />
        <Rect x={0} y={0} width={`${pct * 100}%`} height={8} rx={4} fill="#0284c7" />
      </Svg>
    </View>
  );
}

export default function BusinessDetail() {
  const { id, typeId } = useLocalSearchParams<{ id: string; typeId: string }>();
  const api = useApi();
  const query = useQuery({
    queryKey: ['analysis', id],
    queryFn: async () => (await getAnalysis(id)) ?? api.getAnalysis(id),
  });

  const result = query.data;
  const rec = result?.recommendations.find((r) => r.businessTypeId === typeId);
  const disq = result?.disqualified.find((d) => d.businessTypeId === typeId);
  const entry = rec ?? disq;

  if (!result || !entry) {
    return (
      <Screen>
        <EmptyState title={query.isLoading ? 'Loading…' : 'Business type not found'} />
      </Screen>
    );
  }

  const explanation = entry.explanation;
  const scores = rec?.scores;
  const evidenceById = new Map(result.evidence.map((e) => [e.id, e]));
  const factors = scores?.confidenceFactors;

  return (
    <Screen>
      <ScrollView>
        <Card>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-neutral-100">
              {entry.businessTypeName}
            </Text>
            <VerdictPill verdict={explanation.verdict} />
          </View>
          <Text className="mb-2 text-sm text-neutral-700 dark:text-neutral-300">
            {explanation.headline}
          </Text>
          {scores ? (
            <>
              <ScoreBar label="Opportunity" value={scores.opportunity} tone="opportunity" />
              <ScoreBar label="Risk" value={scores.risk} tone="risk" />
              <ConfidenceMeter confidence={scores.confidence} />
            </>
          ) : null}
        </Card>

        {factors ? (
          <Section title="Why this confidence">
            <Card>
              <FactorBar label="Required signal coverage" value={factors.requiredSignalCoverage} />
              <FactorBar label="Signal quality" value={factors.meanSignalQuality} />
              <FactorBar
                label="Assumption share (lower is better)"
                value={factors.assumptionRatio}
              />
              <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                {factors.gapCount} missing required signal(s)
                {factors.ruleAdjustment !== 0
                  ? ` · rule adjustment ${factors.ruleAdjustment > 0 ? '+' : ''}${factors.ruleAdjustment}`
                  : ''}
              </Text>
            </Card>
          </Section>
        ) : null}

        {disq ? (
          <Section title="Disqualified because">
            <Card>
              {disq.disqualifiedBy.map((o) => (
                <Contribution key={o.ruleId} entry={o} sign="" />
              ))}
            </Card>
          </Section>
        ) : null}

        <Section title="What helps here">
          <Card>
            {explanation.topPositives.length ? (
              explanation.topPositives.map((e) => (
                <Contribution key={e.ruleId} entry={e} sign="+" />
              ))
            ) : (
              <Text className="text-sm text-neutral-500">No positive contributions.</Text>
            )}
          </Card>
        </Section>

        <Section title="What works against it">
          <Card>
            {explanation.topNegatives.length ? (
              explanation.topNegatives.map((e) => <Contribution key={e.ruleId} entry={e} sign="" />)
            ) : (
              <Text className="text-sm text-neutral-500">No negative contributions.</Text>
            )}
          </Card>
        </Section>

        <Section title="Risk factors">
          <Card>
            {explanation.riskFactors.length ? (
              explanation.riskFactors.map((e) => <Contribution key={e.ruleId} entry={e} sign="+" />)
            ) : (
              <Text className="text-sm text-neutral-500">No specific risk factors recorded.</Text>
            )}
          </Card>
        </Section>

        {explanation.assumptionEvidenceIds.length > 0 ? (
          <Section title="Assumptions used">
            <Card>
              {explanation.assumptionEvidenceIds.map((eid) => (
                <Text key={eid} className="mb-1 text-sm text-amber-800 dark:text-amber-300">
                  ~ {evidenceById.get(eid)?.summary ?? eid}
                </Text>
              ))}
            </Card>
          </Section>
        ) : null}

        {explanation.gapEvidenceIds.length > 0 ? (
          <Section title="Missing data (lowers confidence)">
            <Card>
              {explanation.gapEvidenceIds.map((eid) => (
                <Text key={eid} className="mb-1 text-sm text-neutral-600 dark:text-neutral-400">
                  ∅ {evidenceById.get(eid)?.summary ?? eid}
                </Text>
              ))}
            </Card>
          </Section>
        ) : null}

        <View className="mb-8">
          <Text
            className="text-center text-base font-semibold text-blue-700 dark:text-blue-400"
            accessibilityRole="link"
            onPress={() => router.push(`/analysis/${result.id}/evidence`)}
          >
            Open evidence explorer →
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
