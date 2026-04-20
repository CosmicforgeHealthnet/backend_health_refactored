// eslint.config.mjs
import js from '@eslint/js';
import unicorn from 'eslint-plugin-unicorn';

const jestGlobals = {
  jest: true,
  describe: true,
  test: true,
  it: true,
  expect: true,
  beforeEach: true,
  afterEach: true,
  beforeAll: true,
  afterAll: true,
};

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    plugins: {
      unicorn,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        __dirname: true,
        require: true,
        module: true,
        process: true,
        exports: true,
        Buffer: true,
        setImmediate: true,
        clearImmediate: true,
        console:true,
        setTimeout:true,
        setInterval:true,
        clearInterval:true
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-var': 'warn',
      'unicorn/prefer-node-protocol': 'error',

    },
  },
  // Jest test files - add globals so no-undef doesn't fire on jest/describe/test/expect etc.
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: jestGlobals,
    },
  },
];
