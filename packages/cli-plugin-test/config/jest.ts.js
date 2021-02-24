const tsConfig = require('./jest');
module.exports = async () => {
  const config = await tsConfig();
  process.env.MIDWAY_TS_MODE = 'true';
  process.env.MIDWAY_JEST_MODE = 'true';
  return {
    ...config,
    transform: {
      '^.+\\.tsx?$': require.resolve('ts-jest'),
    },
  };
};
