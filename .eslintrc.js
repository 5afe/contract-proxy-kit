module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  root: true,
  rules: {
    'import/no-extraneous-dependencies': ['error', {
      'devDependencies': ['truffle-config.js', 'test/**']
    }],
    'quotes': ['error', 'single'],
    'indent': ['error', 2],
    'max-len': ['error', {
      'code': 100,
      'tabWidth': 2,
      'ignoreComments': false,
      'ignoreRegExpLiterals': true,
      'ignoreStrings': true,
      'ignoreTemplateLiterals': true,
      'ignoreUrls': true
    }],
    'semi': ['error', 'always'],
    'no-unused-vars': ['error', {
      'varsIgnorePattern': 'should|expect'
    }]
  }
};
