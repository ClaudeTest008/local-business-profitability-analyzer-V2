import '../global.css';
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { colorScheme } from 'nativewind';
import { useResolvedTheme } from '../src/lib/hooks';
import { ensureDeviceId, triggerSync } from '../src/lib/sync';
import { getDb } from '../src/lib/db';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function RootLayout() {
  const theme = useResolvedTheme();

  useEffect(() => {
    colorScheme.set(theme);
  }, [theme]);

  useEffect(() => {
    // Boot: open/migrate SQLite, mint device id, kick a background sync.
    void getDb()
      .then(() => {
        ensureDeviceId();
        return triggerSync();
      })
      .catch(() => undefined);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <View className={`flex-1 ${theme === 'dark' ? 'dark' : ''}`}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerTitleStyle: { fontWeight: '600' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="analysis/[id]/index" options={{ title: 'Results' }} />
          <Stack.Screen name="analysis/[id]/type/[typeId]" options={{ title: 'Business Detail' }} />
          <Stack.Screen name="analysis/[id]/evidence" options={{ title: 'Evidence Explorer' }} />
          <Stack.Screen name="project/[id]" options={{ title: 'Project' }} />
        </Stack>
      </View>
    </QueryClientProvider>
  );
}
