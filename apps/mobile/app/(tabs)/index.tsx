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
import { circlePolygonCoords, polygonAreaKm2 } from '@lboa/shared';
import { Button, Card } from '@lboa/ui';
import { useApi, useResolvedTheme } from '../../src/lib/hooks';
import type { IsochroneResponse } from '../../src/lib/api-client';
import { listAnalysisPins, saveAnalysis } from '../../src/lib/db';
import { formatCoords, formatRadius, opportunityTint } from '../../src/lib/format';
import { MAP_STYLES, MAP_STYLE_KEYS, type MapStyleKey } from '../../src/lib/map-styles';
import { STEP_LABEL, useAnalysisProgress } from '../../src/stores/analysis';

const RADII = [300, 500, 800, 1500] as const;
const REACH_MODES = [
  { mode: 'pedestrian', label: 'Walk' },
  { mode: 'bicycle', label: 'Bike' },
  { mode: 'auto', label: 'Drive' },
] as const;
const REACH_MINUTES = [5, 15, 30] as const;

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
  const [reach, setReach] = useState<IsochroneResponse | null>(null);
  const [reachMode, setReachMode] = useState<'pedestrian' | 'bicycle' | 'auto'>('pedestrian');
  const [reachMinutes, setReachMinutes] = useState<number>(15);
  const [reachBusy, setReachBusy] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawRing, setDrawRing] = useState<Array<[number, number]>>([]);

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

  const fetchReach = async () => {
    if (!pin) return;
    setReachBusy(true);
    try {
      setReach(await api.isochrone(pin.lat, pin.lon, reachMode, reachMinutes));
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Reach lookup failed');
    } finally {
      setReachBusy(false);
    }
  };

  const reachCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: reach
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'Polygon', coordinates: reach.rings },
            },
          ]
        : [],
    }),
    [reach],
  );

  const drawCollection = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features:
        drawRing.length >= 3
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Polygon', coordinates: [[...drawRing, drawRing[0]!]] },
              },
            ]
          : [],
    }),
    [drawRing],
  );
  const drawAreaKm2 = drawRing.length >= 3 ? polygonAreaKm2(drawRing) : null;

  return (
    <View className="flex-1">
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={MAP_STYLES[activeStyle]}
        onLongPress={(e) => {
          const [lon, lat] = e.nativeEvent.lngLat;
          setPin({ lat, lon });
          setReach(null);
        }}
        // Only attach in draw mode so it can never interfere with long-press pinning.
        {...(drawMode
          ? {
              onPress: (e: { nativeEvent: { lngLat: [number, number] } }) => {
                const [lon, lat] = e.nativeEvent.lngLat;
                setDrawRing((ring) => [...ring, [lon, lat]]);
              },
            }
          : {})}
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

        {reach ? (
          <GeoJSONSource id="reach" data={reachCollection}>
            <Layer id="reach-fill" type="fill" paint={{ 'fill-color': 'rgba(124,58,237,0.14)' }} />
            <Layer
              id="reach-stroke"
              type="line"
              paint={{
                'line-color': 'rgba(124,58,237,0.9)',
                'line-width': 2,
                'line-dasharray': [2, 1],
              }}
            />
          </GeoJSONSource>
        ) : null}

        {drawRing.length >= 3 ? (
          <GeoJSONSource id="draw" data={drawCollection}>
            <Layer id="draw-fill" type="fill" paint={{ 'fill-color': 'rgba(234,88,12,0.15)' }} />
            <Layer
              id="draw-stroke"
              type="line"
              paint={{ 'line-color': 'rgba(234,88,12,0.9)', 'line-width': 2 }}
            />
          </GeoJSONSource>
        ) : null}

        {drawRing.map(([lon, lat], i) => (
          <Marker key={`d-${i}`} lngLat={[lon, lat]}>
            <View className="h-2.5 w-2.5 rounded-full border border-white bg-orange-600" />
          </Marker>
        ))}

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
        <View className="mt-2 flex-row flex-wrap gap-2">
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
          <Button
            label={drawMode ? 'Drawing…' : 'Draw'}
            tone={drawMode ? 'primary' : 'secondary'}
            onPress={() => {
              setDrawMode((d) => !d);
              if (drawMode) return;
              setDrawRing([]);
            }}
          />
        </View>
        {drawMode || drawRing.length > 0 ? (
          <View className="mt-2 flex-row items-center gap-2">
            <Text
              className="flex-1 rounded-lg bg-white/90 px-2 py-1 text-xs text-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-200"
              accessibilityLiveRegion="polite"
            >
              {drawRing.length < 3
                ? `Tap the map to add vertices (${drawRing.length})`
                : `Area: ${Math.round(drawAreaKm2! * 100) / 100} km² (${drawRing.length} vertices)`}
            </Text>
            <Button
              label="Clear"
              tone="secondary"
              onPress={() => {
                setDrawRing([]);
                setDrawMode(false);
              }}
            />
          </View>
        ) : null}
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
              <View className="mb-2 flex-row gap-2">
                {REACH_MODES.map((m) => (
                  <View key={m.mode} className="flex-1">
                    <Button
                      label={m.label}
                      tone={reachMode === m.mode ? 'primary' : 'secondary'}
                      onPress={() => setReachMode(m.mode)}
                    />
                  </View>
                ))}
                {REACH_MINUTES.map((min) => (
                  <View key={min} className="flex-1">
                    <Button
                      label={`${min}m`}
                      tone={reachMinutes === min ? 'primary' : 'secondary'}
                      onPress={() => setReachMinutes(min)}
                    />
                  </View>
                ))}
              </View>
              <View className="mb-2 flex-row gap-2">
                <View className="flex-1">
                  <Button
                    label={reachBusy ? 'Loading reach…' : reach ? 'Update reach' : 'Show reach'}
                    tone="secondary"
                    onPress={() => void fetchReach()}
                    disabled={reachBusy}
                  />
                </View>
                {reach ? (
                  <View className="flex-1">
                    <Button label="Hide reach" tone="secondary" onPress={() => setReach(null)} />
                  </View>
                ) : null}
              </View>
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
