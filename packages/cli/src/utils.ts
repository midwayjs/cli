import { join } from 'path';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir, platform } from 'os';
export const checkUpdate = (npm?: string) => {
  const startTime = Date.now();
  const lockFile = join(tmpdir(), 'faascliupdate.lock');
  if (existsSync(lockFile)) {
    const content = +readFileSync(lockFile).toString();
    // 更新提示 24 小时
    if (startTime - content < 24 * 3600000) {
      return;
    }
  }
  writeFileSync(lockFile, `${startTime}`);
  const { registry } = findNpm({ npm });
  try {
    const data = execSync(
      `npm ${
        registry ? `--registry=${registry}` : ''
      } view @midwayjs/cli dist-tags --json`,
      {
        cwd: process.env.HOME,
      }
    ).toString();
    const remoteVersion = JSON.parse(data)['latest'];
    const remoteVersionNumber = versionToNumber(remoteVersion);
    const currentVersion = require('../package.json').version;
    const currentVersionNumber = versionToNumber(currentVersion);
    if (remoteVersionNumber > currentVersionNumber) {
      console.log();
      console.log('*********************************************************');
      console.log();
      console.log('   find new version:');
      console.log(`   ${currentVersion} ==> ${remoteVersion}`);
      console.log();
      console.log('   please reinstall @midwayjs/cli module to update.');
      console.log();
      console.log('   npm i @midwayjs/cli -g');
      console.log();
      console.log('*********************************************************');
      console.log();
    }
  } catch (err) {
    console.log('[ Midway ] check update error and skip', err.message);
  }
};

const versionToNumber = version => {
  if (!version) {
    return;
  }
  const versionList = version.split('.');
  return (
    (versionList[0] || 0) * 10e6 +
    (versionList[1] || 0) * 10e3 +
    (versionList[2] || 0) * 1
  );
};

export const findNpm = (argv?) => {
  let npm = 'npm';
  let registry = '';
  // 先找npm客户端
  if (argv?.npm) {
    npm = argv.npm;
  } else if (
    process.env.npm_config_user_agent &&
    /yarn/.test(process.env.npm_config_user_agent)
  ) {
    npm = 'yarn';
  } else if (
    process.env.npm_execpath &&
    /yarn/.test(process.env.npm_execpath)
  ) {
    npm = 'yarn';
  } else if (process.env.yarn_registry) {
    npm = 'yarn';
  } else {
    const npmList = ['cnpm'];
    const currentPlatform = platform();
    const cmd = npmList.find(cmd => {
      if (currentPlatform === 'win32') {
        // for windows
        try {
          const find = execSync(`where ${cmd}`).toString();
          // windows的命令路径至少会有 C/D/E:\ 前缀
          if (find.indexOf(':\\') !== -1) {
            return cmd;
          }
        } catch {
          //
        }
      } else {
        // for mac/linux
        try {
          const find = execSync(`which ${cmd}`).toString();
          // 没有找到not found
          if (find.indexOf('not found') === -1) {
            return cmd;
          }
        } catch {
          //
        }
      }
    });
    if (cmd) {
      npm = cmd;
    }
  }

  // registry
  if (argv?.registry !== undefined) {
    registry = argv.registry || '';
  } else if (npm === 'yarn' && process.env.yarn_registry) {
    registry = process.env.yarn_registry;
  } else if (process.env.npm_config_registry) {
    registry = process.env.npm_config_registry;
  } else {
    // language is zh_CN
    if (process.env.LANG === 'zh_CN.UTF-8') {
      registry = 'https://registry.npm.taobao.org';
    }
  }

  return {
    cmd: `${npm}${registry ? ` --registry=${registry}` : ''}`,
    npm,
    registry,
  };
};
