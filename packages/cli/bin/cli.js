'use strict';
const { debugWrapper } = require('@midwayjs/debugger');
const cliFun = async argv => {
  require('source-map-support/register');
  const { CLI, checkUpdate, findNpm } = require('../dist');
  if (!argv.npm) {
    argv.npm = findNpm(argv).cmd;
  }
  // 检查更新
  checkUpdate(argv.npm);
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

const cli = argv => {
  const isDebug = argv.debug;
  delete argv.debug;
  debugWrapper({
    file: __filename, // 要包裹的方法所在文件
    export: 'cliFun', // 要包裹的方法的方法名
    debug: isDebug,
  })(argv);
};

module.exports = {
  cliFun,
  cli,
};
