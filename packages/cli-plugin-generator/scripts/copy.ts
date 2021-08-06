import fs from 'fs-extra';
import path from 'path';
import cpy from 'cpy';

export async function copyTemplateDir() {
  await cpy('./src/templates', './dist', {
    parents: true,
  }).on('progress', e => {
    // console.log(e);
  });
  fs.moveSync(
    path.resolve(__dirname, '../dist/src/templates'),
    path.resolve(__dirname, '../dist/templates')
  );

  // fs.rmdirSync(path.resolve(__dirname, '../dist/src'));
}

(async () => {
  copyTemplateDir();
})();
