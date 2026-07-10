import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

interface SettingsState {
  apiBaseUrl: string;
  theme: ThemePreference;
  deviceId: string | null;
  setApiBaseUrl: (url: string) => void;
  setTheme: (t: ThemePreference) => void;
  setDeviceId: (id: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      apiBaseUrl: 'http://localhost:3001',
      theme: 'system',
      deviceId: null,
      setApiBaseUrl: (apiBaseUrl) => set({ apiBaseUrl }),
      setTheme: (theme) => set({ theme }),
      setDeviceId: (deviceId) => set({ deviceId }),
    }),
    { name: 'lboa-settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
