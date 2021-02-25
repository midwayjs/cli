#!/usr/bin/env node
'use strict';
const minimist = require('minimist');
const { postinstall } = require('../dist');
const argv = minimist(process.argv.slice(2));
if (argv._.includes['postinstall']) {
  if (process.env.INIT_CWD) {
    postinstall(process.env.INIT_CWD);
  }
} else {
  const { cli } = require('./cli');
  cli(argv);
}
