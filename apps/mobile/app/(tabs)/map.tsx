import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import MapView, { Circle, Marker, type LongPressEvent, type MapType } from 'react-native-maps';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { GeoPoint } from '@lboa/types';
import { Button, Card } from '@lboa/ui';
import { useApi } from '../../src/lib/hooks';
import { listAnalysisPins, saveAnalysis } from '../../src/lib/db';
import { formatCoords, formatRadius, opportunityTint } from '../../src/lib/format';
import { STEP_LABEL, useAnalysisProgress } from '../../src/stores/analysis';

const RADII = [300, 500, 800, 1500] as const;
const MAP_TYPES: Array<{ type: MapType; label: string }> = [
  { type: 'standard', label: 'Map' },
  { type: 'satellite', label: 'Satellite' },
  { type: 'hybrid', label: 'Hybrid' },
  { type: 'terrain', label: 'Terrain' },
];

export default function MapScreen() {
  const api = useApi();
  const qc = useQueryClient();
  const progress = useAnalysisProgress();
  const mapRef = useRef<MapView>(null);
  const [pin, setPin] = useState<GeoPoint | null>(null);
  const [radiusM, setRadiusM] = useState<number>(800);
  const [mapType, setMapType] = useState<MapType>('standard');
  const [search, setSearch] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [heatVisible, setHeatVisible] = useState(true);

  const pins = useQuery({ queryKey: ['analysis-pins'], queryFn: listAnalysisPins });

  const onLongPress = (e: LongPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPin({ lat: latitude, lon: longitude });
  };

  const onSearch = async () => {
    const q = search.trim();
    if (q.length < 2) return;
    setSearchError(null);
    try {
      const res = await api.geocode(q);
      const target = { lat: res.point.lat, lon: res.point.lon };
      setPin(target);
      mapRef.current?.animateToRegion(
        {
          latitude: target.lat,
          longitude: target.lon,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        600,
      );
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    }
  };

  const runAnalysis = async () => {
    if (!pin) return;
    progress.dispatch('start');
    try {
      progress.dispatch('advance');
      const result = await api.analyze({ location: { point: pin, radiusM } });
      progress.dispatch('advance');
      await saveAnalysis(result);
      await qc.invalidateQueries({ queryKey: ['analysis-pins'] });
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
        ref={mapRef}
        style={{ flex: 1 }}
        mapType={mapType}
        initialRegion={{
          latitude: 52.52,
          longitude: 13.405,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onLongPress={onLongPress}
        accessibilityLabel="Map. Long-press to place an analysis pin, or search above."
      >
        {heatVisible
          ? (pins.data ?? []).map((p) => {
              const tint = opportunityTint(p.topOpportunity);
              return (
                <Circle
                  key={p.id}
                  center={{ latitude: p.lat, longitude: p.lon }}
                  radius={p.radiusM}
                  strokeColor={tint.stroke}
                  fillColor={tint.fill}
                />
              );
            })
          : null}
        {(pins.data ?? []).map((p) => (
          <Marker
            key={`m-${p.id}`}
            coordinate={{ latitude: p.lat, longitude: p.lon }}
            title={
              p.topOpportunity !== null
                ? `Top opportunity ${p.topOpportunity}/100 (${opportunityTint(p.topOpportunity).label})`
                : 'Analyzed location'
            }
            opacity={0.7}
            onCalloutPress={() => router.push(`/analysis/${p.id}`)}
          />
        ))}
        {pin ? (
          <>
            <Marker
              coordinate={{ latitude: pin.lat, longitude: pin.lon }}
              title="Analysis location"
              pinColor="blue"
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

      {/* Floating search + map controls */}
      <View className="absolute left-3 right-3 top-3">
        <View className="flex-row gap-2">
          <TextInput
            className="min-h-[44px] flex-1 rounded-xl border border-neutral-300 bg-white/95 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-100"
            placeholder="Search address or place…"
            placeholderTextColor="#737373"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => void onSearch()}
            returnKeyType="search"
            accessibilityLabel="Search address or place"
          />
          <Button label="Go" onPress={() => void onSearch()} disabled={search.trim().length < 2} />
        </View>
        {searchError ? (
          <Text
            className="mt-1 rounded-lg bg-white/90 px-2 py-1 text-xs text-rose-700 dark:bg-neutral-900/90 dark:text-rose-400"
            accessibilityLiveRegion="polite"
          >
            {searchError}
          </Text>
        ) : null}
        <View className="mt-2 flex-row gap-2">
          {MAP_TYPES.map((m) => (
            <Button
              key={m.type}
              label={m.label}
              tone={mapType === m.type ? 'primary' : 'secondary'}
              onPress={() => setMapType(m.type)}
            />
          ))}
          <Button
            label={heatVisible ? 'Heat on' : 'Heat off'}
            tone={heatVisible ? 'primary' : 'secondary'}
            onPress={() => setHeatVisible((v) => !v)}
          />
        </View>
      </View>

      {/* Bottom sheet: analysis launcher */}
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
              Search a place or long-press the map to choose a location. Tinted circles show past
              analyses: green = strong, teal = viable, amber = marginal, red = weak.
            </Text>
          )}
        </Card>
      </View>
    </View>
  );
}
