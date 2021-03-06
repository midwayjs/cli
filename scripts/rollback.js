const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
const { join } = require('path');

const originData = execSync('npx lerna ls --json').toString();
const data = JSON.parse(originData);

const arr = ['#!/bin/bash\n', `# timestamp: ${Date.now()}\n\n`];
const tnpm = ['\n# tnpm:\n\n'];

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
      tnpm.push(
        `tnpm dist-tag add ${item.name}@${version} latest\n`
      );
    }
  }));


  const date = new Date();
  const ymd = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  writeFileSync(join(__dirname, `rollback/${ymd}.sh`), arr.join('') + tnpm.join(''));
  console.log('success');
})();
