#!/usr/bin/env node
'use strict';
const { cli } = require('@midwayjs/cli/bin/cli');
const minimist = require('minimist');
const argv = minimist(process.argv.slice(2));
argv.faas = true;
cli(argv);
