// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      languageOptions: {
        parserOptions: {
          project: true,
        },
      },
      rules: {
        'no-unused-vars': 'warn',
        'no-console': 'warn',
        'semi': 'error',
      },
    },
);