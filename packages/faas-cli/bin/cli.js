#!/usr/bin/env node
'use strict';
const { cli } = require('@midwayjs/cli/bin/cli');
const minimist = require('minimist');
const argv = minimist(process.argv.slice(2));
argv.isFaaS = true;
argv.require = require;
cli(argv);
