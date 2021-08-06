import { BasePlugin } from '@midwayjs/command-core';
import consola from 'consola';
import prettier from 'prettier';
import { inputPromptStringValue, names } from './lib/helper';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { compile as EJSCompile } from 'ejs';

import {
  mountControllerCommand,
  controllerHandler,
} from './core/controller.handler';

// midway-bin gen -> prompt

export class GeneratorPlugin extends BasePlugin {
  commands = {
    gen: {
      usage: 'generator tmp',
      lifecycleEvents: ['gen'],
      commands: {
        ...mountControllerCommand(),
      },
    },
  };

  hooks = {
    'gen:controller:gen': this.controllerHandler.bind(this),
  };

  async controllerHandler() {
    await controllerHandler(this.core, this.options);
  }
}
