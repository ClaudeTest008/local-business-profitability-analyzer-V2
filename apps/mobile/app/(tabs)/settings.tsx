import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, Section, SyncStatusDot } from '@lboa/ui';
import { useSettings, type ThemePreference } from '../../src/stores/settings';
import { useSyncStore } from '../../src/stores/sync';
import { useApi } from '../../src/lib/hooks';
import { triggerSync } from '../../src/lib/sync';
import { formatDate } from '../../src/lib/format';

const THEMES: ThemePreference[] = ['system', 'light', 'dark'];

export default function Settings() {
  const settings = useSettings();
  const sync = useSyncStore();
  const api = useApi();
  const [urlDraft, setUrlDraft] = useState(settings.apiBaseUrl);
  const health = useQuery({
    queryKey: ['health', settings.apiBaseUrl],
    queryFn: api.health,
    retry: 0,
  });

  const applyUrl = () => {
    const trimmed = urlDraft.trim().replace(/\/+$/, '');
    if (/^https?:\/\/.+/.test(trimmed)) settings.setApiBaseUrl(trimmed);
  };

  return (
    <Screen>
      <ScrollView>
        <Section title="API server">
          <Card>
            <TextInput
              className="mb-2 min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
              value={urlDraft}
              onChangeText={setUrlDraft}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              accessibilityLabel="API base URL"
            />
            <Button label="Apply" onPress={applyUrl} disabled={!/^https?:\/\/.+/.test(urlDraft)} />
            <Text className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {health.isSuccess
                ? `Connected — data mode: ${health.data.dataMode}, db: ${health.data.db}, cache: ${health.data.cache}`
                : health.isError
                  ? 'Not reachable. Offline features keep working; analysis needs the server.'
                  : 'Checking…'}
            </Text>
          </Card>
        </Section>

        <Section title="Appearance">
          <View className="flex-row gap-2">
            {THEMES.map((t) => (
              <View key={t} className="flex-1">
                <Button
                  label={t}
                  tone={settings.theme === t ? 'primary' : 'secondary'}
                  onPress={() => settings.setTheme(t)}
                />
              </View>
            ))}
          </View>
        </Section>

        <Section title="Synchronization">
          <Card>
            <View className="mb-2 flex-row items-center justify-between">
              <SyncStatusDot status={sync.pendingCount > 0 ? 'pending' : sync.status} />
              <Text className="text-sm text-neutral-600 dark:text-neutral-400">
                {sync.pendingCount} pending
              </Text>
            </View>
            <Text className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
              Last sync: {sync.lastSyncAt ? formatDate(sync.lastSyncAt) : 'never'}
              {sync.lastError ? `\n${sync.lastError}` : ''}
            </Text>
            <Button label="Sync now" onPress={() => void triggerSync()} />
          </Card>
        </Section>

        <Section title="About">
          <Card>
            <Text className="text-sm text-neutral-700 dark:text-neutral-300">
              Local Business Opportunity Analyzer v0.1.0{'\n'}
              Deterministic, explainable location intelligence. Opportunity, Risk and Confidence are
              always shown separately and every recommendation traces to evidence — including
              assumptions and gaps.{'\n\n'}
              Accessibility: this app targets WCAG AA — all controls are labeled for screen readers,
              scores are never conveyed by color alone, and touch targets are at least 44pt.
              Feedback welcome via the repository.
            </Text>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
