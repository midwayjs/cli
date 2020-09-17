module.exports = async () => {
  return {
    rootDir: process.env.MIDWAY_BIN_JEST_ROOT_DIR || process.cwd(),
  };
};
