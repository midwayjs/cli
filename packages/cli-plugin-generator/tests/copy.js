// FIXME: this file should be placed otherwise
const fs = require('fs-extra');
const path = require('path');

fs.removeSync(path.resolve(__dirname, './fixtures/base'));

fs.copySync(
  path.resolve(__dirname, './fixtures/source'),
  path.resolve(__dirname, './fixtures/base')
);
