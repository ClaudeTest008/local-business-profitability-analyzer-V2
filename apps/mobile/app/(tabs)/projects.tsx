import { useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Button, Card, EmptyState, Screen, Section, SyncStatusDot } from '@lboa/ui';
import { listProjects } from '../../src/lib/db';
import { createProject } from '../../src/lib/mutations';
import { triggerSync } from '../../src/lib/sync';
import { useSyncStore } from '../../src/stores/sync';
import { formatDate } from '../../src/lib/format';

export default function Dashboard() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const sync = useSyncStore();
  const projects = useQuery({ queryKey: ['projects'], queryFn: listProjects });

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createProject(trimmed);
    setName('');
    await qc.invalidateQueries({ queryKey: ['projects'] });
  };

  return (
    <Screen>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Projects</Text>
        <SyncStatusDot status={sync.pendingCount > 0 ? 'pending' : sync.status} />
      </View>

      <Card>
        <Text className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
          New research project
        </Text>
        <TextInput
          className="mb-2 min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
          placeholder="e.g. Downtown corner unit"
          placeholderTextColor="#737373"
          value={name}
          onChangeText={setName}
          accessibilityLabel="Project name"
          maxLength={200}
        />
        <Button label="Create project" onPress={() => void onCreate()} disabled={!name.trim()} />
      </Card>

      <Section title="Your projects">
        <FlatList
          data={projects.data ?? []}
          keyExtractor={(p) => p.id}
          refreshControl={
            <RefreshControl
              refreshing={projects.isFetching}
              onRefresh={() => {
                void triggerSync();
                void qc.invalidateQueries({ queryKey: ['projects'] });
              }}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="No projects yet"
              hint="Create a project, then drop a pin on the Map tab to analyze a location."
            />
          }
          renderItem={({ item }) => (
            <Card>
              <Text
                className="text-base font-semibold text-blue-700 dark:text-blue-400"
                accessibilityRole="link"
                onPress={() => router.push(`/project/${item.id}`)}
              >
                {item.name}
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                Updated {formatDate(item.updatedAt)}
              </Text>
            </Card>
          )}
        />
      </Section>
    </Screen>
  );
}
