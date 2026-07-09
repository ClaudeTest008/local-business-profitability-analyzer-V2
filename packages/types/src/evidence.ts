import { z } from 'zod';
import { signalKeySchema } from './signal.js';

/**
 * Evidence taxonomy:
 * - raw:        data as fetched/observed (provider payloads, field observations)
 * - derived:    computed from other evidence (always lists derivedFrom)
 * - assumption: configured default used because real data is unavailable — surfaced, never hidden
 * - gap:        explicit record that required data is missing (reliability is always 0)
 */
export const EVIDENCE_KINDS = ['raw', 'derived', 'assumption', 'gap'] as const;
export const evidenceKindSchema = z.enum(EVIDENCE_KINDS);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

export const evidenceSourceSchema = z.object({
  /** e.g. 'overpass', 'field-research', 'engine-derivation', 'assumption-defaults' */
  providerId: z.string().min(1),
  /** How the data was obtained/derived, human readable and deterministic. */
  method: z.string().min(1),
  /** ISO timestamp of fetch/observation. Absent for gaps. */
  observedAt: z.string().datetime({ offset: true }).optional(),
});
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;

export const evidenceSchema = z.object({
  /** Deterministic content-hash id (same content → same id). */
  id: z.string().min(1),
  kind: evidenceKindSchema,
  /** Signals this evidence informs (for gaps: the signals that are missing). */
  signalKeys: z.array(signalKeySchema),
  source: evidenceSourceSchema,
  /** One-sentence human-readable statement of what this evidence says. */
  summary: z.string().min(1),
  /** Structured payload (provider response extract, observation values). */
  payload: z.unknown().optional(),
  /** For derived evidence: the evidence ids it was computed from. */
  derivedFrom: z.array(z.string()).optional(),
  /** 0–1. Gaps are always 0; assumptions are low; field research and fresh provider data high. */
  reliability: z.number().min(0).max(1),
});
export type Evidence = z.infer<typeof evidenceSchema>;
