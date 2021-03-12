const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
const { join } = require('path');

const originData = execSync('npx lerna ls --json').toString();
const data = JSON.parse(originData);

const arr = ['#!/bin/bash\n\n'];
const sync = ['\n# sync:\n\n'];
let versionBase;
(async () => {
  await Promise.all(data.map(item => {
    console.log('---->', item.name);
    if (item.private === false) {
      const version = execSync(
        `npm --registry=https://r.npm.taobao.org show ${item.name} version`
      ).toString().replace('\n', '');
      arr.push(
        `npm dist-tag add ${item.name}@${version} latest\n`
      );
      sync.push(
        `cnpm sync ${item.name}\n`,
        `tnpm sync ${item.name}\n`,
      );
      if (item.name === '@midwayjs/cli') {
        versionBase = version;
      }
    }
  }));

  writeFileSync(join(__dirname, `rollback/${versionBase}.sh`), arr.join('') + sync.join(''));
  console.log(`rollback ${versionBase} gen success`);
})();
