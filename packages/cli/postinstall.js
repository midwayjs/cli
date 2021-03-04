const { join } = require('path');
const { existsSync } = require('fs');
const postonstallPath = join(__dirname, './dist/postinstall.js');
const doing = async () => {
  if (!process.env.INIT_CWD) {
    return;
  }
  if (!existsSync(postonstallPath)) {
    return;
  }
  const postInstallMod = require(postonstallPath);
  postInstallMod.postinstall(process.env.INIT_CWD);
};

doing();
