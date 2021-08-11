import { BasePlugin } from '@midwayjs/command-core';
import consola from 'consola';
import inquirer from 'inquirer';
import chalk from 'chalk';
import {
  AvailableInternalGenerator,
  AvailableExternalGenerator,
} from './utils';

import controllerHandler, {
  mountControllerCommand,
} from './core/internal/controller.handler';
import serviceHandler, {
  mountServiceCommand,
} from './core/internal/service.handler';
import middlewareHandler, {
  mountMiddlewareCommand,
} from './core/internal/middleware.handler';
import serverlessHandler, {
  mountServerlessCommand,
} from './core/internal/serverless.handler';

import ormHandler, {
  mountORMCommand,
  TypeORMGeneratorType,
} from './core/external/orm.handler';
import debugHandler, { mountDebugCommand } from './core/internal/debug.handler';
import axiosHandler, { mountAxiosCommand } from './core/external/axios.handler';
import cacheHandler, { mountCacheCommand } from './core/external/cache.handler';
import ossHandler, { mountOSSCommand } from './core/external/oss.handler';
import swaggerHandler, {
  mountSwaggerCommand,
} from './core/external/swagger.handler';
import webSocketHandler, {
  mountWebSocketCommand,
  WebSocketGeneratorType,
} from './core/external/websocket.handler';
import prismaHandler, {
  mountPrismaCommand,
} from './core/external/prisma.handler';

// midway-bin gen -> prompt

export class GeneratorPlugin extends BasePlugin {
  commands = {
    gen: {
      usage: 'generator tmp',
      lifecycleEvents: ['gen'],

      commands: {
        // internal
        ...mountControllerCommand(),
        ...mountServiceCommand(),
        ...mountDebugCommand(),
        ...mountMiddlewareCommand(),
        ...mountServerlessCommand(),
        // external
        ...mountORMCommand(),
        ...mountAxiosCommand(),
        ...mountCacheCommand(),
        ...mountOSSCommand(),
        ...mountSwaggerCommand(),
        ...mountWebSocketCommand(),
        ...mountPrismaCommand(),
      },
    },
  };

  hooks = {
    // entry
    'gen:gen': this.noGeneratorSpecifiedHandler.bind(this),
    // internal
    'gen:controller:gen': this.invokeControllerHandler.bind(this),
    'gen:service:gen': this.invokeServiceHandler.bind(this),
    'gen:debug:gen': this.invokeDebugHandler.bind(this),
    'gen:middleware:gen': this.invokeMiddlewareHandler.bind(this),
    'gen:sls:gen': this.invokeServerlessHandler.bind(this),

    // external
    // orm
    'gen:orm:gen': this.invokeORMHandler.bind(this),
    'gen:orm:setup:gen': this.invokeORMHandler.bind(
      this,
      TypeORMGeneratorType.SETUP
    ),
    'gen:orm:entity:gen': this.invokeORMHandler.bind(
      this,
      TypeORMGeneratorType.ENTITY
    ),
    'gen:orm:subscriber:gen': this.invokeORMHandler.bind(
      this,
      TypeORMGeneratorType.SUBSCRIBER
    ),
    // axios
    'gen:axios:gen': this.invokeAxiosHandler.bind(this),
    // cache
    'gen:cache:gen': this.invokeCacheHandler.bind(this),
    // oss
    'gen:oss:gen': this.invokeOSSHandler.bind(this),
    // swagger
    'gen:swagger:gen': this.invokeSwaggerHandler.bind(this),
    // web socket
    'gen:ws:gen': this.invokeWebSocketHandler.bind(this),
    'gen:ws:setup:gen': this.invokeWebSocketHandler.bind(
      this,
      WebSocketGeneratorType.SETUP
    ),
    'gen:ws:controller:gen': this.invokeWebSocketHandler.bind(
      this,
      WebSocketGeneratorType.Controller
    ),
    // prisma
    'gen:prisma:gen': this.invokePismaHandler.bind(this),
  };

  // TODO: generate by enum AST
  availableInternalGenerators: Set<AvailableInternalGenerator> = new Set([
    AvailableInternalGenerator.Controller,
    AvailableInternalGenerator.Service,
    AvailableInternalGenerator.Debug,
    AvailableInternalGenerator.Serverless,
    AvailableInternalGenerator.Middleware,
  ]);

  availableExternalGenerators: Set<AvailableExternalGenerator> = new Set([
    AvailableExternalGenerator.Axios,
    AvailableExternalGenerator.Cache,
    AvailableExternalGenerator.ORM,
    AvailableExternalGenerator.OSS,
    AvailableExternalGenerator.Prisma,
    AvailableExternalGenerator.Swagger,
    AvailableExternalGenerator.WebSocket,
  ]);

  async invokeControllerHandler() {
    await controllerHandler({
      core: this.core,
      options: this.options,
    });
  }

  async invokeServiceHandler() {
    await serviceHandler(this.core, this.options);
  }

  async invokeDebugHandler() {
    await debugHandler(this.core, this.options);
  }

  async invokeMiddlewareHandler() {
    await middlewareHandler(this.core, this.options);
  }

  async invokeServerlessHandler() {
    await serverlessHandler(this.core, this.options);
  }

  async invokeORMHandler(type?: TypeORMGeneratorType) {
    await ormHandler({
      core: this.core,
      options: this.options,
      type,
    });
  }

  async invokeAxiosHandler() {
    await axiosHandler(this.core, this.options);
  }

  async invokeCacheHandler() {
    await cacheHandler(this.core, this.options);
  }

  async invokeOSSHandler() {
    await ossHandler(this.core, this.options);
  }

  async invokeSwaggerHandler() {
    await swaggerHandler(this.core, this.options);
  }

  async invokeWebSocketHandler(type?: WebSocketGeneratorType) {
    await webSocketHandler(this.core, this.options, type);
  }

  async invokePismaHandler() {
    await prismaHandler(this.core, this.options);
  }

  async noGeneratorSpecifiedHandler() {
    const promptedType = await inquirer.prompt([
      {
        name: 'type',
        type: 'list',
        loop: true,
        choices: [
          ...Array.from(this.availableInternalGenerators),
          ...Array.from(this.availableExternalGenerators),
        ] as (AvailableInternalGenerator | AvailableExternalGenerator)[],
      },
    ]);

    consola.success(`Invoking Generator: ${chalk.cyan(promptedType.type)}`);

    switch (promptedType.type) {
      // Internal
      case AvailableInternalGenerator.Controller:
        await this.invokeControllerHandler();
        break;
      case AvailableInternalGenerator.Debug:
        await this.invokeDebugHandler();
        break;
      case AvailableInternalGenerator.Service:
        await this.invokeServiceHandler();
        break;
      case AvailableInternalGenerator.Middleware:
        await this.invokeMiddlewareHandler();
        break;
      case AvailableInternalGenerator.Serverless:
        await this.invokeServerlessHandler();
        break;

      // External
      case AvailableExternalGenerator.Axios:
        await this.invokeAxiosHandler();
        break;
      case AvailableExternalGenerator.Cache:
        await this.invokeCacheHandler();
        break;
      case AvailableExternalGenerator.ORM:
        await this.invokeORMHandler();
        break;
      case AvailableExternalGenerator.OSS:
        await this.invokeOSSHandler();
        break;
      case AvailableExternalGenerator.Prisma:
        await this.invokePismaHandler();
        break;
      case AvailableExternalGenerator.Swagger:
        await this.invokeSwaggerHandler();
        break;
      case AvailableExternalGenerator.WebSocket:
        await this.invokeWebSocketHandler();
        break;
    }
  }
}
