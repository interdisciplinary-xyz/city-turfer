// Shared ESLint flat config: the rules every CityTurfer workspace uses (modelled on empatalk's base
// preset). Platform presets (react-native.mjs, next.mjs) add to it.
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/ios/**',
      '**/android/**',
      '**/.expo/**',
      '**/.next/**',
      '**/out/**',
      '**/vendor/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/dist/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  eslintConfigPrettier, // before our rules on purpose: it disables `curly`, which we re-enable below
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
    plugins: { 'simple-import-sort': simpleImportSort, 'unused-imports': unusedImports },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      curly: ['error', 'multi-line'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Tests, config files and dev tools (CLI scripts print to stdout)
    files: ['**/__tests__/**', '**/test-support/**', '**/*.config.*', '**/*.cjs', '**/plugins/**', '**/tools/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off', 'no-console': 'off' },
  },
];
