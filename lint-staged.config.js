module.exports = {
  '*.js': [
    'node ./node_modules/eslint/bin/eslint.js --fix',
    'node ./node_modules/jest/bin/jest.js --findRelatedTests --passWithNoTests',
  ],
};
