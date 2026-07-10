import { useMemo, useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { Evidence, EvidenceKind } from '@lboa/types';
import { Button, Card, EmptyState, EvidenceKindBadge, Screen } from '@lboa/ui';
import { getAnalysis } from '../../../src/lib/db';
import { useApi } from '../../../src/lib/hooks';
import { formatDate } from '../../../src/lib/format';

const KINDS: Array<EvidenceKind | 'all'> = ['all', 'raw', 'derived', 'assumption', 'gap'];

export default function EvidenceExplorer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const [kind, setKind] = useState<EvidenceKind | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['analysis', id],
    queryFn: async () => (await getAnalysis(id)) ?? api.getAnalysis(id),
  });
  const evidence = query.data?.evidence ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return evidence.filter(
      (e) =>
        (kind === 'all' || e.kind === kind) &&
        (q === '' ||
          e.summary.toLowerCase().includes(q) ||
          e.source.providerId.toLowerCase().includes(q)),
    );
  }, [evidence, kind, search]);

  const renderDetail = (e: Evidence) => (
    <View className="mt-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
      <Text className="text-xs text-neutral-600 dark:text-neutral-400">
        Provider: {e.source.providerId}
        {'\n'}Method: {e.source.method}
        {e.source.observedAt ? `\nObserved: ${formatDate(e.source.observedAt)}` : ''}
        {'\n'}Reliability: {Math.round(e.reliability * 100)}%{'\n'}Informs signals:{' '}
        {e.signalKeys.join(', ') || '(context only)'}
        {e.derivedFrom?.length ? `\nDerived from: ${e.derivedFrom.join(', ')}` : ''}
      </Text>
    </View>
  );

  return (
    <Screen>
      <TextInput
        className="mb-2 min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
        placeholder="Search evidence…"
        placeholderTextColor="#737373"
        value={search}
        onChangeText={setSearch}
        accessibilityLabel="Search evidence"
      />
      <View className="mb-2 flex-row flex-wrap gap-2">
        {KINDS.map((k) => (
          <Button
            key={k}
            label={k === 'all' ? `All (${evidence.length})` : k}
            tone={kind === k ? 'primary' : 'secondary'}
            onPress={() => setKind(k)}
          />
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        initialNumToRender={15}
        ListEmptyComponent={<EmptyState title="No evidence matches" />}
        renderItem={({ item }) => (
          <Card>
            <View className="mb-1 flex-row items-center justify-between">
              <EvidenceKindBadge kind={item.kind} />
              <Text
                className="text-xs font-semibold text-blue-700 dark:text-blue-400"
                accessibilityRole="button"
                accessibilityLabel={expanded === item.id ? 'Hide provenance' : 'Show provenance'}
                onPress={() => setExpanded((cur) => (cur === item.id ? null : item.id))}
              >
                {expanded === item.id ? 'Hide details' : 'Details'}
              </Text>
            </View>
            <Text className="text-sm text-neutral-800 dark:text-neutral-200">{item.summary}</Text>
            {expanded === item.id ? renderDetail(item) : null}
          </Card>
        )}
      />
    </Screen>
  );
}
