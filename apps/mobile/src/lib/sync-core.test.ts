import { describe, expect, it } from 'vitest';
import { applyRemote, backoffMs, buildEnvelope, nextCursor, nextRevision } from './sync-core';

describe('nextRevision', () => {
  it('starts at 1 and increments', () => {
    expect(nextRevision(undefined)).toBe(1);
    expect(nextRevision(1)).toBe(2);
    expect(nextRevision(41)).toBe(42);
  });
});

describe('buildEnvelope', () => {
  it('carries all LWW fields', () => {
    const env = buildEnvelope(
      {
        entityType: 'project',
        entityId: 'p1',
        revision: 3,
        updatedAt: '2026-07-09T10:00:00Z',
        deleted: false,
        payload: { name: 'X' },
      },
      'dev_a',
    );
    expect(env).toEqual({
      entityType: 'project',
      entityId: 'p1',
      revision: 3,
      updatedAt: '2026-07-09T10:00:00Z',
      deviceId: 'dev_a',
      deleted: false,
      payload: { name: 'X' },
    });
  });
});

describe('applyRemote (LWW)', () => {
  const t1 = '2026-07-09T10:00:00Z';
  const t2 = '2026-07-09T11:00:00Z';

  it('no local → take remote', () => {
    expect(applyRemote(undefined, { revision: 1, updatedAt: t1 })).toBe('take_remote');
  });
  it('higher remote revision wins', () => {
    expect(applyRemote({ revision: 1, updatedAt: t2 }, { revision: 2, updatedAt: t1 })).toBe(
      'take_remote',
    );
  });
  it('higher local revision wins', () => {
    expect(applyRemote({ revision: 3, updatedAt: t1 }, { revision: 2, updatedAt: t2 })).toBe(
      'keep_local',
    );
  });
  it('equal revision → newer updatedAt wins, tie keeps local', () => {
    expect(applyRemote({ revision: 2, updatedAt: t1 }, { revision: 2, updatedAt: t2 })).toBe(
      'take_remote',
    );
    expect(applyRemote({ revision: 2, updatedAt: t2 }, { revision: 2, updatedAt: t2 })).toBe(
      'keep_local',
    );
  });
});

describe('backoffMs', () => {
  it('doubles per attempt and caps', () => {
    expect(backoffMs(0)).toBe(2000);
    expect(backoffMs(1)).toBe(4000);
    expect(backoffMs(3)).toBe(16000);
    expect(backoffMs(20)).toBe(300000);
  });
});

describe('nextCursor', () => {
  it('only moves forward', () => {
    expect(nextCursor(undefined, '2026-01-01T00:00:00Z')).toBe('2026-01-01T00:00:00Z');
    expect(nextCursor('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z')).toBe('2026-01-02T00:00:00Z');
    expect(nextCursor('2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z')).toBe('2026-01-03T00:00:00Z');
  });
});
