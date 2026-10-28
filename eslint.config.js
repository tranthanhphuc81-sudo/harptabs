import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-recorder', 'dist-kalimba', 'dist-guitar', 'dist-pianica', 'dist-tranh', 'dev-dist', 'public', 'android', 'android-recorder', 'android-kalimba', 'android-guitar', 'android-pianica', 'android-tranh', 'worker/node_modules', 'worker/.wrangler'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.worker } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // tsc đã báo biến thừa (noUnusedLocals)
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  { files: ['**/*.test.ts', 'scripts/**', '*.config.*'], languageOptions: { globals: globals.node } },
);
