import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings } from '../stores/settings';
import { createApiClient } from './api-client';

export function useApi() {
  const baseUrl = useSettings((s) => s.apiBaseUrl);
  return useMemo(() => createApiClient(baseUrl), [baseUrl]);
}

export function useResolvedTheme(): 'light' | 'dark' {
  const pref = useSettings((s) => s.theme);
  const system = useColorScheme();
  if (pref === 'system') return system === 'dark' ? 'dark' : 'light';
  return pref;
}
