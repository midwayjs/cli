#!/usr/bin/env node
'use strict';
const minimist = require('minimist');
const argv = minimist(process.argv.slice(2));
const { cli } = require('./cli');
cli(argv);
