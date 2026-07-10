import { describe, expect, it } from 'vitest';
import { nextStep } from './analysis';

describe('analysis progress state machine', () => {
  it('happy path: idle → collecting → evidence → scoring → done', () => {
    let s = nextStep('idle', 'start');
    expect(s).toBe('collecting');
    s = nextStep(s, 'advance');
    expect(s).toBe('evidence');
    s = nextStep(s, 'advance');
    expect(s).toBe('scoring');
    s = nextStep(s, 'advance');
    expect(s).toBe('done');
  });

  it('fail from any active step → error; reset → idle', () => {
    expect(nextStep('collecting', 'fail')).toBe('error');
    expect(nextStep('scoring', 'fail')).toBe('error');
    expect(nextStep('idle', 'fail')).toBe('idle');
    expect(nextStep('error', 'reset')).toBe('idle');
  });

  it('start only from idle/done/error', () => {
    expect(nextStep('collecting', 'start')).toBe('collecting');
    expect(nextStep('done', 'start')).toBe('collecting');
    expect(nextStep('error', 'start')).toBe('collecting');
  });

  it('advance is a no-op outside active steps', () => {
    expect(nextStep('idle', 'advance')).toBe('idle');
    expect(nextStep('done', 'advance')).toBe('done');
  });
});
