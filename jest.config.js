module.exports = (options = {}) => {
  process.env.MIDWAY_TS_MODE = 'true';
  process.env.MIDWAY_JEST_MODE = 'true';
  return Object.assign(
    {
      preset: 'ts-jest',
      testPathIgnorePatterns: ['<rootDir>/test/fixtures'],
      coveragePathIgnorePatterns: ['<rootDir>/test/'],
    },
    options
  );
};
