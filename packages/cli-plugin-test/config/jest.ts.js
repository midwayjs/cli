const tsConfig = require('./jest');
module.exports = async () => {
  const config = await tsConfig();
  return {
    ...config,
    preset: 'ts-jest',
  };
};
