'use strict';
const { findNpm } = require('@midwayjs/command-core');
const cli = async argv => {
  require('source-map-support/register');

  const { CLI, checkUpdate } = require('../dist');
  if (!argv.npm) {
    argv.npm = findNpm(argv).cmd;
  }
  // 检查更新
  await checkUpdate();
  const cli = new CLI(argv);
  cli
    .start()
    .then(() => {
      process.exit();
    })
    .catch(e => {
      console.log('\n\n\n');
      console.log(
        'Error! You can try adding the -V parameter for more information output.'
      );
      console.log('\n\n\n');
      console.error(e);
      process.exitCode = 1;
      process.exit(1);
    });
};

module.exports = {
  cli,
};
