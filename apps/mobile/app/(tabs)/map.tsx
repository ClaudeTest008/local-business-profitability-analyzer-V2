import { useState } from 'react';
import { Text, View } from 'react-native';
import MapView, { Circle, Marker, type LongPressEvent } from 'react-native-maps';
import { router } from 'expo-router';
import type { GeoPoint } from '@lboa/types';
import { Button, Card } from '@lboa/ui';
import { useApi } from '../../src/lib/hooks';
import { saveAnalysis } from '../../src/lib/db';
import { formatCoords, formatRadius } from '../../src/lib/format';
import { STEP_LABEL, useAnalysisProgress } from '../../src/stores/analysis';

const RADII = [300, 500, 800, 1500] as const;

export default function MapScreen() {
  const api = useApi();
  const progress = useAnalysisProgress();
  const [pin, setPin] = useState<GeoPoint | null>(null);
  const [radiusM, setRadiusM] = useState<number>(800);

  const onLongPress = (e: LongPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPin({ lat: latitude, lon: longitude });
  };

  const runAnalysis = async () => {
    if (!pin) return;
    progress.dispatch('start');
    try {
      progress.dispatch('advance'); // collecting → evidence happens server-side; UI reflects phases
      const result = await api.analyze({ location: { point: pin, radiusM } });
      progress.dispatch('advance');
      await saveAnalysis(result);
      progress.dispatch('advance');
      router.push(`/analysis/${result.id}`);
      progress.dispatch('reset');
    } catch (e) {
      progress.dispatch('fail', e instanceof Error ? e.message : String(e));
    }
  };

  const busy = progress.step !== 'idle' && progress.step !== 'error' && progress.step !== 'done';

  return (
    <View className="flex-1">
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 52.52,
          longitude: 13.405,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onLongPress={onLongPress}
        accessibilityLabel="Map. Long-press to place an analysis pin."
      >
        {pin ? (
          <>
            <Marker
              coordinate={{ latitude: pin.lat, longitude: pin.lon }}
              title="Analysis location"
            />
            <Circle
              center={{ latitude: pin.lat, longitude: pin.lon }}
              radius={radiusM}
              strokeColor="rgba(29,78,216,0.8)"
              fillColor="rgba(29,78,216,0.15)"
            />
          </>
        ) : null}
      </MapView>

      <View className="absolute bottom-3 left-3 right-3">
        <Card>
          {pin ? (
            <>
              <Text className="mb-1 text-sm text-neutral-700 dark:text-neutral-300">
                {formatCoords(pin.lat, pin.lon)} · radius {formatRadius(radiusM)}
              </Text>
              <View className="mb-2 flex-row gap-2">
                {RADII.map((r) => (
                  <View key={r} className="flex-1">
                    <Button
                      label={formatRadius(r)}
                      tone={r === radiusM ? 'primary' : 'secondary'}
                      onPress={() => setRadiusM(r)}
                    />
                  </View>
                ))}
              </View>
              {busy ? (
                <Text
                  className="mb-2 text-sm text-blue-700 dark:text-blue-400"
                  accessibilityLiveRegion="polite"
                >
                  {STEP_LABEL[progress.step]}
                </Text>
              ) : null}
              {progress.step === 'error' ? (
                <Text className="mb-2 text-sm text-rose-700 dark:text-rose-400">
                  {progress.error ?? 'Analysis failed'} — check API URL in Settings and
                  connectivity. Analysis needs a network connection.
                </Text>
              ) : null}
              <Button label="Analyze here" onPress={() => void runAnalysis()} disabled={busy} />
            </>
          ) : (
            <Text className="text-sm text-neutral-700 dark:text-neutral-300">
              Long-press anywhere on the map to choose the location to analyze.
            </Text>
          )}
        </Card>
      </View>
    </View>
  );
}
