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
  npm = npm || findNpm().cmd;
  try {
    const data = execSync(`${npm} view @midwayjs/cli dist-tags --json`, {
      cwd: process.env.HOME,
    }).toString();
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
      console.log(`   ${npm} i @midwayjs/cli -g`);
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

export const findNpm = () => {
  const npmList = [{ cmd: 'cnpm' }, { cmd: 'npm' }];
  const currentPlatform = platform();
  for (const npmInfo of npmList) {
    const { cmd } = npmInfo;
    if (currentPlatform === 'win32') {
      // for windows
      try {
        const find = execSync(`where ${cmd}`).toString();
        // windows的命令路径至少会有 C/D/E:\ 前缀
        if (find.indexOf(':\\') !== -1) {
          return npmInfo;
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
          return npmInfo;
        }
      } catch {
        //
      }
    }
  }
  return npmList[npmList.length - 1];
};
