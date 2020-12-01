const tsConfig = require('./jest');
module.exports = async () => {
  const config = await tsConfig();
  return {
    ...config,
    transform: {
      '^.+\\.tsx?$': require.resolve('ts-jest'),
    },
  };
};
