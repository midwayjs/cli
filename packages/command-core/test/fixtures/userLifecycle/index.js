const { unlinkSync, existsSync, writeFileSync } = require('fs');
const { join } = require('path');
;(async () => {
  await new Promise(resolve => {
    setTimeout(resolve, 500);
  });
  const file = join(__dirname, 'test.txt');
  if (existsSync(file)) {
    unlinkSync(file);
  }
  writeFileSync(file, 'user');
})();