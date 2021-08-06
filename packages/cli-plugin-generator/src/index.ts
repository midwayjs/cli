import { BasePlugin } from '@midwayjs/command-core';
import consola from 'consola';
import prettier from 'prettier';
import inquirer from 'inquirer';
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
    'gen:gen': this.noGeneratorSpecifiedHandler.bind(this),
    'gen:controller:gen': this.controllerHandler.bind(this),
  };

  async controllerHandler() {
    await controllerHandler(this.core, this.options);
  }

  async ormHandler() {}

  async noGeneratorSpecifiedHandler() {
    const promptedType = await inquirer.prompt([
      {
        name: 'type',
        type: 'list',
        loop: true,
        choices: ['controller', 'orm'],
      },
    ]);

    consola.success(`Invoking Generator: ${chalk.cyan(promptedType.type)}`);

    switch (promptedType.type) {
      case 'controller':
        await this.controllerHandler();
        break;
      case 'orm':
        await this.ormHandler();
        break;
    }
  }
}
