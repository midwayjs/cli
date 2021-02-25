#!/usr/bin/env node
'use strict';
const minimist = require('minimist');
const { postinstall } = require('../dist');
const argv = minimist(process.argv.slice(2));
const cmd = [].concat(argv._);
if (cmd.includes(postinstall)) {
  if (process.env.INIT_CWD) {
    postinstall(process.env.INIT_CWD);
  }
} else {
  const { cli } = require('./cli');
  cli(argv);
}
