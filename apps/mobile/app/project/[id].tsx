import { Alert, FlatList, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, EmptyState, Screen, Section, SyncStatusDot } from '@lboa/ui';
import { listAnalyses, listObservations, listProjects } from '../../src/lib/db';
import { deleteProject } from '../../src/lib/mutations';
import { useSyncStore } from '../../src/stores/sync';
import { formatDate } from '../../src/lib/format';

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const sync = useSyncStore();

  const project = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
    select: (all) => all.find((p) => p.id === id),
  });
  const analyses = useQuery({ queryKey: ['analyses', id], queryFn: () => listAnalyses(id) });
  const observations = useQuery({
    queryKey: ['observations', id],
    queryFn: () => listObservations(id),
  });

  const onDelete = () => {
    Alert.alert('Delete project?', 'The project is removed from all devices after sync.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteProject(id).then(() => {
            void qc.invalidateQueries({ queryKey: ['projects'] });
            router.back();
          });
        },
      },
    ]);
  };

  if (!project.data) {
    return (
      <Screen>
        <EmptyState title={project.isLoading ? 'Loading…' : 'Project not found'} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {project.data.name}
          </Text>
          <SyncStatusDot status={sync.pendingCount > 0 ? 'pending' : sync.status} />
        </View>
        {project.data.notes ? (
          <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {project.data.notes}
          </Text>
        ) : null}
      </Card>

      <Section title={`Analyses (${analyses.data?.length ?? 0})`}>
        <FlatList
          data={analyses.data ?? []}
          keyExtractor={(a) => a.id}
          ListEmptyComponent={
            <EmptyState title="No analyses yet" hint="Run one from the Map tab." />
          }
          renderItem={({ item }) => (
            <Card>
              <Text
                className="text-sm font-semibold text-blue-700 dark:text-blue-400"
                accessibilityRole="link"
                onPress={() => router.push(`/analysis/${item.id}`)}
              >
                Analysis {formatDate(item.createdAt)}
              </Text>
            </Card>
          )}
        />
      </Section>

      <Section title={`Observations (${observations.data?.length ?? 0})`}>
        <FlatList
          data={observations.data ?? []}
          keyExtractor={(o) => o.id}
          ListEmptyComponent={
            <EmptyState title="No field observations" hint="Capture them in the Research tab." />
          }
          renderItem={({ item }) => (
            <Card>
              <Text className="text-sm text-neutral-800 dark:text-neutral-200">
                {item.type.replace(/_/g, ' ')} — {formatDate(item.observedAt)}
              </Text>
              {item.note ? (
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">{item.note}</Text>
              ) : null}
            </Card>
          )}
        />
      </Section>

      <View className="mb-6">
        <Button label="Delete project" tone="danger" onPress={onDelete} />
      </View>
    </Screen>
  );
}
