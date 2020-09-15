module.exports = (options = {}) => {
  return Object.assign(
    {
      preset: 'ts-jest',
      testEnvironment: '../../packages/bin/jest/env.js',
      testPathIgnorePatterns: ['<rootDir>/test/fixtures'],
      coveragePathIgnorePatterns: ['<rootDir>/test/'],
    },
    options
  );
};
