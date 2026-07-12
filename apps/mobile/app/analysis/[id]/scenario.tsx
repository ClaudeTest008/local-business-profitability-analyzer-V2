import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { AnalysisResult, SignalKey } from '@lboa/types';
import { Button, Card, EmptyState, Screen, Section } from '@lboa/ui';
import { getAnalysis, saveAnalysis } from '../../../src/lib/db';
import { useApi } from '../../../src/lib/hooks';

/** Signals a user can plausibly reason about in a what-if (all score_0_100 or ratio). */
const SIMULATABLE: Array<{ key: SignalKey; label: string; presets: number[]; unit: string }> = [
  { key: 'footTraffic', label: 'Foot traffic', presets: [20, 50, 80, 95], unit: '/100' },
  { key: 'parkingAvailability', label: 'Parking', presets: [20, 50, 80, 95], unit: '/100' },
  { key: 'transitAccess', label: 'Transit access', presets: [20, 50, 80, 95], unit: '/100' },
  { key: 'pedestrianInfra', label: 'Pedestrian infra', presets: [20, 50, 80, 95], unit: '/100' },
  { key: 'vacancyRate', label: 'Vacancy rate', presets: [0.05, 0.15, 0.3, 0.5], unit: ' (0–1)' },
  {
    key: 'populationDensity',
    label: 'Population density',
    presets: [500, 2000, 5000, 12000],
    unit: '/km²',
  },
];

export default function ScenarioSimulator() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const [signalKey, setSignalKey] = useState<SignalKey>('footTraffic');
  const [value, setValue] = useState<number | null>(null);
  const [rationale, setRationale] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<AnalysisResult | null>(null);

  const baseQuery = useQuery({
    queryKey: ['analysis', id],
    queryFn: async () => (await getAnalysis(id)) ?? api.getAnalysis(id),
  });
  const base = baseQuery.data;
  const selected = SIMULATABLE.find((s) => s.key === signalKey)!;

  if (!base) {
    return (
      <Screen>
        <EmptyState title={baseQuery.isLoading ? 'Loading…' : 'Analysis not found'} />
      </Screen>
    );
  }

  const baseline = base.signals.find((s) => s.key === signalKey);

  const run = async () => {
    if (value === null || !rationale.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const result = await api.analyze({
        ...base.request,
        scenarioOverrides: [{ key: signalKey, value, rationale: rationale.trim() }],
      });
      await saveAnalysis(result);
      setScenario(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const compareRows = scenario
    ? scenario.recommendations.slice(0, 10).map((after) => {
        const before = base.recommendations.find((r) => r.businessTypeId === after.businessTypeId);
        return {
          id: after.businessTypeId,
          name: after.businessTypeName,
          before: before?.scores.opportunity ?? null,
          after: after.scores.opportunity,
          rankBefore: before?.rank ?? null,
          rankAfter: after.rank,
        };
      })
    : [];

  return (
    <Screen>
      <ScrollView>
        <Section title="What-if scenario">
          <Card>
            <Text className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
              Override one signal and re-run the deterministic engine. The override is recorded as
              assumption evidence — results clearly show what was simulated.
            </Text>
            <View className="mb-2 flex-row flex-wrap gap-2">
              {SIMULATABLE.map((s) => (
                <Button
                  key={s.key}
                  label={s.label}
                  tone={signalKey === s.key ? 'primary' : 'secondary'}
                  onPress={() => {
                    setSignalKey(s.key);
                    setValue(null);
                    setScenario(null);
                  }}
                />
              ))}
            </View>
            <Text className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">
              Current: {baseline ? `${baseline.value}${selected.unit}` : 'no data (gap)'}
            </Text>
            <View className="mb-2 flex-row gap-2">
              {selected.presets.map((p) => (
                <View key={p} className="flex-1">
                  <Button
                    label={`${p}${selected.unit}`}
                    tone={value === p ? 'primary' : 'secondary'}
                    onPress={() => setValue(p)}
                  />
                </View>
              ))}
            </View>
            <TextInput
              className="mb-2 min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              placeholder="Why plausible? e.g. 'new tram line opening 2027'"
              placeholderTextColor="#737373"
              value={rationale}
              onChangeText={setRationale}
              accessibilityLabel="Scenario rationale"
              maxLength={300}
            />
            {error ? (
              <Text className="mb-2 text-sm text-rose-700 dark:text-rose-400">{error}</Text>
            ) : null}
            <Button
              label={running ? 'Re-running engine…' : 'Run scenario'}
              onPress={() => void run()}
              disabled={running || value === null || !rationale.trim()}
            />
          </Card>
        </Section>

        {scenario ? (
          <Section title="Top 10 after scenario (opportunity before → after)">
            <Card>
              {compareRows.map((row) => {
                const delta = row.before !== null ? row.after - row.before : null;
                return (
                  <View
                    key={row.id}
                    className="mb-2 flex-row items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800"
                    accessible
                    accessibilityLabel={`${row.name}: opportunity ${row.before ?? 'new'} to ${row.after}`}
                  >
                    <Text
                      className="flex-1 text-sm text-neutral-800 dark:text-neutral-200"
                      numberOfLines={1}
                    >
                      {row.rankAfter}. {row.name}
                    </Text>
                    <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {row.before ?? '–'} → {row.after}
                      {delta !== null && delta !== 0 ? (
                        <Text
                          className={
                            delta > 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }
                        >
                          {'  '}({delta > 0 ? '+' : ''}
                          {Math.round(delta * 10) / 10})
                        </Text>
                      ) : null}
                    </Text>
                  </View>
                );
              })}
              <Button
                label="Open full scenario results"
                tone="secondary"
                onPress={() => router.push(`/analysis/${scenario.id}`)}
              />
            </Card>
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
