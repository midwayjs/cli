const { existsSync } = require('fs');
const { join } = require('path');
module.exports = async () => {
  const rootDir = process.env.MIDWAY_BIN_JEST_ROOT_DIR || process.cwd();
  const userJestConfigFile = join(rootDir, 'jest.config.js');
  let userJestConfig = {};
  if (existsSync(userJestConfigFile)) {
    try {
      const userJestModele = require(userJestConfigFile);
      if (typeof userJestModele === 'function') {
        userJestConfig = await userJestModele({});
      } else {
        userJestConfig = userJestModele;
      }
    } catch (e) {
      //
    }
  }
  return {
    rootDir,
    testEnvironment: 'node',
    testPathIgnorePatterns: ['<rootDir>/test/fixtures'],
    coveragePathIgnorePatterns: ['<rootDir>/test/'],
    ...userJestConfig,
  };
};
