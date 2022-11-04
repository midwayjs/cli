module.exports = (options = {}) => {
  process.env.MIDWAY_TS_MODE = 'true';
  process.env.MIDWAY_JEST_MODE = 'true';
  if (process.version.startsWith('v18')) {
    process.env.NODE_OPTIONS='--openssl-legacy-provider';
  }
  return Object.assign(
    {
      preset: 'ts-jest',
      testEnvironment: 'node',
      testPathIgnorePatterns: ['<rootDir>/test/fixtures'],
      coveragePathIgnorePatterns: ['<rootDir>/test/', '/node_modules/'],
    },
    options
  );
};
