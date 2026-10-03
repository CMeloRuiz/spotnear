/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh'],
  rules: {
    // El proyecto no usa PropTypes: los componentes están documentados con
    // JSDoc y la validación de verdad la hace el backend.
    'react/prop-types': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react-refresh/only-export-components': 'off',
    // `fetchpriority` va en minúscula a propósito: el camelCase `fetchPriority`
    // recién lo reconoce React 19 y en React 18 dispara un warning en consola.
    // El atributo se usa en la imagen del hero, que es el elemento LCP.
    'react/no-unknown-property': ['error', { ignore: ['fetchpriority'] }],
  },
  ignorePatterns: ['dist', 'node_modules'],
};
