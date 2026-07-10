import { create } from 'zustand';

export type AnalysisStep = 'idle' | 'collecting' | 'evidence' | 'scoring' | 'done' | 'error';

/** Legal transitions of the analysis progress state machine — kept pure for testing. */
export function nextStep(
  current: AnalysisStep,
  event: 'start' | 'advance' | 'fail' | 'reset',
): AnalysisStep {
  switch (event) {
    case 'start':
      return current === 'idle' || current === 'done' || current === 'error'
        ? 'collecting'
        : current;
    case 'advance':
      if (current === 'collecting') return 'evidence';
      if (current === 'evidence') return 'scoring';
      if (current === 'scoring') return 'done';
      return current;
    case 'fail':
      return current === 'idle' ? current : 'error';
    case 'reset':
      return 'idle';
  }
}

export const STEP_LABEL: Record<AnalysisStep, string> = {
  idle: 'Ready',
  collecting: 'Collecting provider data…',
  evidence: 'Building evidence…',
  scoring: 'Evaluating 200+ business types…',
  done: 'Analysis complete',
  error: 'Analysis failed',
};

interface AnalysisProgressState {
  step: AnalysisStep;
  error: string | null;
  dispatch: (event: 'start' | 'advance' | 'fail' | 'reset', error?: string) => void;
}

export const useAnalysisProgress = create<AnalysisProgressState>((set, get) => ({
  step: 'idle',
  error: null,
  dispatch: (event, error) =>
    set({ step: nextStep(get().step, event), error: event === 'fail' ? (error ?? null) : null }),
}));
