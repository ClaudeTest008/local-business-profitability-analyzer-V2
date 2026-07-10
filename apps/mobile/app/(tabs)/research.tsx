import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import type { FieldObservation, FieldObservationType, GeoPoint } from '@lboa/types';
import { fieldObservationSchema } from '@lboa/types';
import { Button, Card, EmptyState, Screen, Section } from '@lboa/ui';
import { listProjects } from '../../src/lib/db';
import { newObservationId, saveObservation } from '../../src/lib/mutations';
import { formatCoords } from '../../src/lib/format';

const OBSERVATION_TYPES: Array<{ type: FieldObservationType; label: string }> = [
  { type: 'photo', label: 'Photo' },
  { type: 'voice_note', label: 'Voice' },
  { type: 'manual_observation', label: 'Note' },
  { type: 'traffic_count', label: 'Traffic' },
  { type: 'parking_count', label: 'Parking' },
  { type: 'competitor_observation', label: 'Competitor' },
  { type: 'vacancy_note', label: 'Vacancy' },
  { type: 'construction_observation', label: 'Construction' },
  { type: 'accessibility_observation', label: 'Accessibility' },
];

export default function Research() {
  const projects = useQuery({ queryKey: ['projects'], queryFn: listProjects });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [obsType, setObsType] = useState<FieldObservationType>('manual_observation');
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const useGps = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      setMessage('Location permission denied — enter coordinates manually.');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setPoint({ lat: pos.coords.latitude, lon: pos.coords.longitude });
  };

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);

  const takePhoto = async (fromCamera: boolean) => {
    const fn = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setMessage('Camera permission denied.');
        return;
      }
    }
    const res = await fn({ mediaTypes: 'images', quality: 0.7 });
    const uri = res.assets?.[0]?.uri;
    if (uri) setField('mediaUri', uri);
  };

  const toggleRecording = async () => {
    if (recording) {
      await recorder.stop();
      setRecording(false);
      if (recorder.uri) setField('mediaUri', recorder.uri);
      return;
    }
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setMessage('Microphone permission denied.');
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  const field = (key: string) => fields[key] ?? '';
  const setField = (key: string, value: string) => setFields((f) => ({ ...f, [key]: value }));
  const num = (key: string) => Number(fields[key] ?? NaN);

  const save = async () => {
    if (!projectId || !point) return;
    const base = {
      id: newObservationId(),
      projectId,
      point,
      note: field('note'),
      observedAt: new Date().toISOString(),
    };
    const candidate: unknown = (() => {
      switch (obsType) {
        case 'photo':
          return {
            ...base,
            type: obsType,
            mediaUri: field('mediaUri'),
            caption: field('caption') || undefined,
          };
        case 'voice_note':
          return { ...base, type: obsType, mediaUri: field('mediaUri') };
        case 'manual_observation':
          return { ...base, type: obsType, text: field('text') };
        case 'traffic_count':
          return {
            ...base,
            type: obsType,
            pedestrians: num('pedestrians'),
            vehicles: num('vehicles'),
            durationMinutes: num('durationMinutes'),
            timeOfDay: field('timeOfDay') || 'midday',
          };
        case 'parking_count':
          return {
            ...base,
            type: obsType,
            totalSpaces: num('totalSpaces'),
            occupiedSpaces: num('occupiedSpaces'),
          };
        case 'competitor_observation':
          return {
            ...base,
            type: obsType,
            businessTypeId: field('businessTypeId'),
            name: field('name') || undefined,
          };
        case 'vacancy_note':
          return {
            ...base,
            type: obsType,
            vacantUnits: num('vacantUnits'),
            totalUnitsObserved: num('totalUnitsObserved'),
          };
        case 'construction_observation':
          return {
            ...base,
            type: obsType,
            description: field('description'),
            impact: field('impact') || 'unknown',
          };
        case 'accessibility_observation':
          return {
            ...base,
            type: obsType,
            wheelchairAccessible: field('wheelchairAccessible') === 'yes',
            stepFreeEntry: field('stepFreeEntry') === 'yes',
            description: field('description') || undefined,
          };
        default:
          return { ...base, type: obsType };
      }
    })();

    const parsed = fieldObservationSchema.safeParse(candidate);
    if (!parsed.success) {
      setMessage(
        `Invalid: ${parsed.error.issues[0]?.path.join('.')} — ${parsed.error.issues[0]?.message}`,
      );
      return;
    }
    await saveObservation(parsed.data as FieldObservation);
    setFields({});
    setMessage('Saved locally — will sync in background.');
  };

  const NUMERIC_FIELDS: Partial<Record<FieldObservationType, string[]>> = {
    traffic_count: ['pedestrians', 'vehicles', 'durationMinutes'],
    parking_count: ['totalSpaces', 'occupiedSpaces'],
    vacancy_note: ['vacantUnits', 'totalUnitsObserved'],
  };
  const TEXT_FIELDS: Partial<Record<FieldObservationType, string[]>> = {
    manual_observation: ['text'],
    traffic_count: ['timeOfDay'],
    competitor_observation: ['businessTypeId', 'name'],
    construction_observation: ['description', 'impact'],
    accessibility_observation: ['wheelchairAccessible', 'stepFreeEntry', 'description'],
  };

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Section title="Field research">
          {projects.data?.length ? (
            <View className="mb-2 flex-row flex-wrap gap-2">
              {projects.data.map((p) => (
                <Button
                  key={p.id}
                  label={p.name}
                  tone={projectId === p.id ? 'primary' : 'secondary'}
                  onPress={() => setProjectId(p.id)}
                />
              ))}
            </View>
          ) : (
            <EmptyState title="Create a project first" hint="Observations attach to a project." />
          )}
        </Section>

        {projectId ? (
          <>
            <Section title="Observation type">
              <View className="flex-row flex-wrap gap-2">
                {OBSERVATION_TYPES.map((o) => (
                  <Button
                    key={o.type}
                    label={o.label}
                    tone={obsType === o.type ? 'primary' : 'secondary'}
                    onPress={() => {
                      setObsType(o.type);
                      setFields({});
                      setMessage(null);
                    }}
                  />
                ))}
              </View>
            </Section>

            <Section title="Location">
              <Card>
                <Text className="mb-2 text-sm text-neutral-700 dark:text-neutral-300">
                  {point ? formatCoords(point.lat, point.lon) : 'No position captured yet'}
                </Text>
                <Button label="Use current GPS position" onPress={() => void useGps()} />
              </Card>
            </Section>

            <Section title="Details">
              <Card>
                {obsType === 'photo' ? (
                  <View className="mb-2 flex-row gap-2">
                    <View className="flex-1">
                      <Button label="Take photo" onPress={() => void takePhoto(true)} />
                    </View>
                    <View className="flex-1">
                      <Button
                        label="Pick from library"
                        tone="secondary"
                        onPress={() => void takePhoto(false)}
                      />
                    </View>
                  </View>
                ) : null}
                {obsType === 'voice_note' ? (
                  <View className="mb-2">
                    <Button
                      label={recording ? 'Stop recording' : 'Record voice note'}
                      tone={recording ? 'danger' : 'primary'}
                      onPress={() => void toggleRecording()}
                    />
                  </View>
                ) : null}
                {(obsType === 'photo' || obsType === 'voice_note') && field('mediaUri') ? (
                  <Text className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
                    Captured: {field('mediaUri').split('/').pop()}
                  </Text>
                ) : null}
                {(NUMERIC_FIELDS[obsType] ?? []).map((key) => (
                  <TextInput
                    key={key}
                    className="mb-2 min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                    placeholder={key}
                    placeholderTextColor="#737373"
                    keyboardType="numeric"
                    value={field(key)}
                    onChangeText={(v) => setField(key, v)}
                    accessibilityLabel={key}
                  />
                ))}
                {(TEXT_FIELDS[obsType] ?? []).map((key) => (
                  <TextInput
                    key={key}
                    className="mb-2 min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                    placeholder={key}
                    placeholderTextColor="#737373"
                    value={field(key)}
                    onChangeText={(v) => setField(key, v)}
                    accessibilityLabel={key}
                  />
                ))}
                <TextInput
                  className="mb-2 min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
                  placeholder="note (optional)"
                  placeholderTextColor="#737373"
                  value={field('note')}
                  onChangeText={(v) => setField('note', v)}
                  accessibilityLabel="Optional note"
                />
                {message ? (
                  <Text
                    className="mb-2 text-sm text-neutral-700 dark:text-neutral-300"
                    accessibilityLiveRegion="polite"
                  >
                    {message}
                  </Text>
                ) : null}
                <Button label="Save observation" onPress={() => void save()} disabled={!point} />
              </Card>
            </Section>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
