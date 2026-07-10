import type { PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { EvidenceKind, SyncStatus, Verdict } from '@lboa/types';
import {
  EVIDENCE_KIND_CLASS,
  EVIDENCE_KIND_GLYPH,
  EVIDENCE_KIND_LABEL,
  SYNC_STATUS_CLASS,
  SYNC_STATUS_LABEL,
  VERDICT_CLASS,
  VERDICT_LABEL,
  formatConfidence,
  formatScore,
  scoresA11ySummary,
} from './theme.js';

export function Screen({ children }: PropsWithChildren) {
  return <View className="flex-1 bg-neutral-50 px-4 py-2 dark:bg-neutral-950">{children}</View>;
}

export function Card({ children }: PropsWithChildren) {
  return (
    <View className="mb-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      {children}
    </View>
  );
}

export function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <View className="mb-4" accessibilityRole="none">
      <Text
        className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-100"
        accessibilityRole="header"
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View className="items-center py-10">
      <Text className="text-base font-medium text-neutral-700 dark:text-neutral-300">{title}</Text>
      {hint ? (
        <Text className="mt-1 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-blue-700 dark:bg-blue-600'
      : tone === 'danger'
        ? 'bg-rose-700'
        : 'bg-neutral-200 dark:bg-neutral-800';
  const textClass = tone === 'secondary' ? 'text-neutral-900 dark:text-neutral-100' : 'text-white';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-[44px] items-center justify-center rounded-lg px-4 py-3 ${toneClass} ${disabled ? 'opacity-40' : ''}`}
    >
      <Text className={`text-base font-semibold ${textClass}`}>{label}</Text>
    </Pressable>
  );
}

/** Score bar: value always shown as text — never color-only (WCAG AA). */
export function ScoreBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'opportunity' | 'risk';
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = tone === 'opportunity' ? 'bg-emerald-600' : 'bg-rose-600';
  return (
    <View
      className="mb-2"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${formatScore(value)}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <View className="mb-1 flex-row justify-between">
        <Text className="text-sm text-neutral-700 dark:text-neutral-300">{label}</Text>
        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {formatScore(value)}
        </Text>
      </View>
      <View className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800">
        <View className={`h-2 rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}

export function ConfidenceMeter({ confidence }: { confidence: number }) {
  const pct = Math.max(0, Math.min(1, confidence)) * 100;
  return (
    <View
      className="mb-2"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Confidence: ${formatConfidence(confidence)}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
    >
      <View className="mb-1 flex-row justify-between">
        <Text className="text-sm text-neutral-700 dark:text-neutral-300">Confidence</Text>
        <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {formatConfidence(confidence)}
        </Text>
      </View>
      <View className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800">
        <View className="h-2 rounded-full bg-sky-600" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  return (
    <View
      className={`self-start rounded-full px-3 py-1 ${VERDICT_CLASS[verdict]}`}
      accessible
      accessibilityLabel={`Verdict: ${VERDICT_LABEL[verdict]}`}
    >
      <Text className="text-xs font-bold text-white">{VERDICT_LABEL[verdict]}</Text>
    </View>
  );
}

export function EvidenceKindBadge({ kind }: { kind: EvidenceKind }) {
  return (
    <View
      className={`flex-row items-center self-start rounded-full px-2 py-0.5 ${EVIDENCE_KIND_CLASS[kind]}`}
      accessible
      accessibilityLabel={`Evidence kind: ${EVIDENCE_KIND_LABEL[kind]}`}
    >
      <Text className="text-xs font-bold text-white">
        {EVIDENCE_KIND_GLYPH[kind]} {EVIDENCE_KIND_LABEL[kind]}
      </Text>
    </View>
  );
}

export function SyncStatusDot({ status }: { status: SyncStatus }) {
  return (
    <View
      className="flex-row items-center"
      accessible
      accessibilityLabel={`Sync status: ${SYNC_STATUS_LABEL[status]}`}
    >
      <View className={`mr-1 h-2.5 w-2.5 rounded-full ${SYNC_STATUS_CLASS[status]}`} />
      <Text className="text-xs text-neutral-600 dark:text-neutral-400">
        {SYNC_STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

export function RecommendationCard({
  name,
  category,
  rank,
  verdict,
  opportunity,
  risk,
  confidence,
  headline,
  onPress,
}: {
  name: string;
  category: string;
  rank: number;
  verdict: Verdict;
  opportunity: number;
  risk: number;
  confidence: number;
  headline: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rank ${rank}: ${name}, ${VERDICT_LABEL[verdict]}. ${scoresA11ySummary(opportunity, risk, confidence)}`}
      accessibilityHint="Opens detailed explanation with evidence"
      onPress={onPress}
      className="mb-3 min-h-[44px] rounded-xl border border-neutral-200 bg-white p-4 active:opacity-80 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <View className="mb-2 flex-row items-center justify-between">
        <Text
          className="flex-1 text-base font-bold text-neutral-900 dark:text-neutral-100"
          numberOfLines={1}
        >
          {rank}. {name}
        </Text>
        <VerdictPill verdict={verdict} />
      </View>
      <Text className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">{category}</Text>
      <ScoreBar label="Opportunity" value={opportunity} tone="opportunity" />
      <ScoreBar label="Risk" value={risk} tone="risk" />
      <ConfidenceMeter confidence={confidence} />
      <Text className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{headline}</Text>
    </Pressable>
  );
}
