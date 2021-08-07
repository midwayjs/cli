import { BasePlugin } from '@midwayjs/command-core';
import consola from 'consola';
import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  mountControllerCommand,
  controllerHandler,
} from './core/internal/controller.handler';
import {
  mountORMCommand,
  ormHandler,
  TypeORMGeneratorType,
} from './core/external/orm.handler';
import {
  mountServiceCommand,
  serviceHandler,
} from './core/internal/service.handler';

// midway-bin gen -> prompt

export class GeneratorPlugin extends BasePlugin {
  commands = {
    gen: {
      usage: 'generator tmp',
      lifecycleEvents: ['gen'],
      commands: {
        ...mountControllerCommand(),
        ...mountServiceCommand(),
        ...mountORMCommand(),
      },
    },
  };

  hooks = {
    'gen:gen': this.noGeneratorSpecifiedHandler.bind(this),
    'gen:controller:gen': this.controllerHandler.bind(this),
    'gen:service:gen': this.serviceHandler.bind(this),
    'gen:orm:gen': this.ormHandler.bind(this),
    'gen:orm:setup:gen': this.ormHandler.bind(this, TypeORMGeneratorType.SETUP),
    'gen:orm:entity:gen': this.ormHandler.bind(
      this,
      TypeORMGeneratorType.ENTITY
    ),
    'gen:orm:subscriber:gen': this.ormHandler.bind(
      this,
      TypeORMGeneratorType.SUBSCRIBER
    ),
  };

  async controllerHandler() {
    await controllerHandler(this.core, this.options);
  }

  async serviceHandler() {
    await serviceHandler(this.core, this.options);
  }

  async ormHandler(type?: TypeORMGeneratorType) {
    await ormHandler(this.core, this.options, type);
  }

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
