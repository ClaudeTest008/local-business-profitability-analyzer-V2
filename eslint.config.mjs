import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/drizzle/**',
      '**/*.config.{js,mjs,cjs,ts}',
      '**/babel.config.js',
      '**/metro.config.js',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-globals': [
        'error',
        {
          name: 'Math',
          message:
            'Import from @lboa/shared where determinism matters; Math.random is forbidden in engine code.',
        },
      ],
    },
  },
  {
    // Math is fine outside deterministic engine packages; the engine-specific ban is re-applied below.
    files: ['**/*.{ts,tsx}'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['packages/{engine,rules,scoring,evidence,taxonomy}/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Deterministic packages must not use Math.random.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Pass timestamps in explicitly; Date.now breaks determinism.',
        },
      ],
    },
  },
);
