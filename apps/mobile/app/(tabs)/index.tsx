import { useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { GeoPoint } from '@lboa/types';
import { circlePolygonCoords } from '@lboa/shared';
import { Button, Card } from '@lboa/ui';
import { useApi, useResolvedTheme } from '../../src/lib/hooks';
import { listAnalysisPins, saveAnalysis } from '../../src/lib/db';
import { formatCoords, formatRadius, opportunityTint } from '../../src/lib/format';
import { MAP_STYLES, MAP_STYLE_KEYS, type MapStyleKey } from '../../src/lib/map-styles';
import { STEP_LABEL, useAnalysisProgress } from '../../src/stores/analysis';

const RADII = [300, 500, 800, 1500] as const;

function circleFeature(
  point: GeoPoint,
  radiusM: number,
  properties: Record<string, unknown>,
): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties,
    geometry: { type: 'Polygon', coordinates: [circlePolygonCoords(point, radiusM)] },
  };
}

export default function MapScreen() {
  const api = useApi();
  const qc = useQueryClient();
  const theme = useResolvedTheme();
  const progress = useAnalysisProgress();
  const cameraRef = useRef<CameraRef>(null);
  const [pin, setPin] = useState<GeoPoint | null>(null);
  const [radiusM, setRadiusM] = useState<number>(800);
  const [styleKey, setStyleKey] = useState<MapStyleKey | null>(null);
  const [search, setSearch] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [heatVisible, setHeatVisible] = useState(true);

  const pins = useQuery({ queryKey: ['analysis-pins'], queryFn: listAnalysisPins });
  // Default style follows the app theme until the user picks one explicitly.
  const activeStyle: MapStyleKey = styleKey ?? (theme === 'dark' ? 'dark' : 'standard');

  const heatCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: (pins.data ?? []).map((p) => {
        const tint = opportunityTint(p.topOpportunity);
        return circleFeature({ lat: p.lat, lon: p.lon }, p.radiusM, {
          fill: tint.fill,
          stroke: tint.stroke,
        });
      }),
    }),
    [pins.data],
  );

  const pinCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: pin
        ? [
            circleFeature(pin, radiusM, {
              fill: 'rgba(29,78,216,0.15)',
              stroke: 'rgba(29,78,216,0.8)',
            }),
          ]
        : [],
    }),
    [pin, radiusM],
  );

  const onSearch = async () => {
    const q = search.trim();
    if (q.length < 2) return;
    setSearchError(null);
    try {
      const res = await api.geocode(q);
      const target = { lat: res.point.lat, lon: res.point.lon };
      setPin(target);
      cameraRef.current?.flyTo({ center: [target.lon, target.lat], zoom: 14, duration: 700 });
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
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={MAP_STYLES[activeStyle]}
        onLongPress={(e) => {
          const [lon, lat] = e.nativeEvent.lngLat;
          setPin({ lat, lon });
        }}
        accessibilityLabel="Map. Long-press to place an analysis pin, or search above."
      >
        <Camera ref={cameraRef} initialViewState={{ center: [13.405, 52.52], zoom: 12 }} />

        {heatVisible && heatCollection.features.length > 0 ? (
          <GeoJSONSource id="heat" data={heatCollection}>
            <Layer
              id="heat-fill"
              type="fill"
              paint={{ 'fill-color': ['get', 'fill'], 'fill-opacity': 0.9 }}
            />
            <Layer
              id="heat-stroke"
              type="line"
              paint={{ 'line-color': ['get', 'stroke'], 'line-width': 1.5 }}
            />
          </GeoJSONSource>
        ) : null}

        {pin ? (
          <GeoJSONSource id="pin-radius" data={pinCollection}>
            <Layer
              id="pin-fill"
              type="fill"
              paint={{ 'fill-color': ['get', 'fill'], 'fill-opacity': 0.9 }}
            />
            <Layer
              id="pin-stroke"
              type="line"
              paint={{ 'line-color': ['get', 'stroke'], 'line-width': 2 }}
            />
          </GeoJSONSource>
        ) : null}

        {(pins.data ?? []).map((p) => (
          <Marker
            key={p.id}
            lngLat={[p.lon, p.lat]}
            onPress={() => router.push(`/analysis/${p.id}`)}
          >
            <View
              className="h-4 w-4 rounded-full border-2 border-white bg-indigo-600"
              accessibilityLabel={
                p.topOpportunity !== null
                  ? `Analyzed location, top opportunity ${p.topOpportunity} of 100`
                  : 'Analyzed location'
              }
            />
          </Marker>
        ))}

        {pin ? (
          <Marker lngLat={[pin.lon, pin.lat]}>
            <View
              className="h-5 w-5 rounded-full border-2 border-white bg-blue-700"
              accessibilityLabel="Analysis location pin"
            />
          </Marker>
        ) : null}
      </MapLibreMap>

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
          {MAP_STYLE_KEYS.map((k) => (
            <Button
              key={k}
              label={k}
              tone={activeStyle === k ? 'primary' : 'secondary'}
              onPress={() => setStyleKey(k)}
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
