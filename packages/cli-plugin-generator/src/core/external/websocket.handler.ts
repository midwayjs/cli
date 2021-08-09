import { ICommandInstance, ICoreInstance } from '@midwayjs/command-core';

import path from 'path';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import consola from 'consola';
import chalk from 'chalk';
import { compile as EJSCompile } from 'ejs';
import { Project } from 'ts-morph';
import prettier from 'prettier';
import { inputPromptStringValue, formatTSFile, names } from '../../lib/helper';

import { capitalCase } from 'capital-case';

import { ensureDepsInstalled, addNPMScripts } from '../../lib/package';
import {
  addConstExport,
  updateDecoratorArrayArgs,
  addImportDeclaration,
  ImportType,
} from '../../lib/ast';
import { generatorInvokeWrapper } from '../../lib/wrapper';

import {
  GeneratorSharedOptions,
  sharedOption,
  applyTruthyDefaultValue,
  applyFalsyDefaultValue,
  ensureBooleanType,
  applyDefaultValueToSharedOption,
} from '../utils';
import pick from 'lodash/pick';
import omit from 'lodash/omit';

export interface WebSocketOptions extends GeneratorSharedOptions {
  // /**
  //  * @description Generate ws-bootstrap.js & add npm scripts for WebSocket app start
  //  * @value true
  //  */
  // bootstrap?: boolean;
  /**
   * @description Import namespace for @midwayjs/ws import
   * @value ws
   */
  namespace?: string;
  /**
   * @description Class identifier, works in controller
   */
  class?: string;
}

export enum WebSocketGeneratorType {
  SETUP = 'setup',
  Controller = 'controller',
}

export const WEB_SOCKET_DEP = ['@midwayjs/ws'];

export const scriptKey = 'start:ws';

export const scriptValue =
  'cross-env NODE_ENV=local midway-bin dev --ts --entryFile=ws-bootstrap.js';

export const WriterGenerator: WebSocketGeneratorType[] = [
  WebSocketGeneratorType.Controller,
];

export const mountWebSocketCommand = (): ICommandInstance => {
  const writerSharedOptions = {
    class: {
      usage: 'Class identifier, works in controller',
    },
    bootstrap: {
      usage:
        'Generate ws-bootstrap.js & add npm scripts for WebSocket app start',
    },
  };

  return {
    ws: {
      usage: 'ws genrator',
      lifecycleEvents: ['gen'],
      commands: {
        setup: {
          lifecycleEvents: ['gen'],
          opts: {
            ...pick(sharedOption, 'dry'),
            namespace: {
              usage: 'Import namespace for @midwayjs/ws import',
            },
          },
        },
        controller: {
          lifecycleEvents: ['gen'],
          opts: {
            ...sharedOption,
            ...writerSharedOptions,
          },
        },
      },
    },
  };
};

async function webSocketHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: WebSocketOptions,
  type: WebSocketGeneratorType
) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  if (!type) {
    consola.info('Choose generator type:');
    type = (
      await inquirer.prompt([
        {
          name: 'type',
          type: 'list',
          choices: ['setup', 'controller'] as WebSocketGeneratorType[],
        },
      ])
    ).type as WebSocketGeneratorType;
  }

  if (WriterGenerator.includes(type) && !opts.class) {
    consola.warn(`${capitalCase(type)} name cannot be empty!`);
    opts.class = await inputPromptStringValue(`${type} name`, 'ws');
  }

  const { dry, dotFile, override } = applyDefaultValueToSharedOption(opts);
  const { namespace = 'ws' } = opts;

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  // TODO: modify names internal for skip
  const nameNames = names(opts.class ?? '__SKIP__');
  const fileNameNames = names(opts.file ?? opts.class ?? '__SKIP__');

  switch (type) {
    case WebSocketGeneratorType.SETUP:
      dry
        ? consola.info('`[DryRun]` Skip dependencies installation check.')
        : await ensureDepsInstalled(WEB_SOCKET_DEP, projectDirPath);

      const renderedBootStrapTemplate = EJSCompile(
        fs.readFileSync(
          path.join(__dirname, `../../templates/websocket/bootstrap.js.ejs`),
          { encoding: 'utf8' }
        ),
        {}
      )({});

      const outputBootStrapContent = prettier.format(
        renderedBootStrapTemplate,
        {
          parser: 'typescript',
          singleQuote: true,
        }
      );

      const generatedBootStrapPath = path.resolve(
        projectDirPath,
        `ws-bootstrap.js`
      );

      if (!dry) {
        consola.info('Source code will be transformed.');

        const project = new Project();

        const configurationPath = path.resolve(
          projectDirPath,
          './src/configuration.ts'
        );

        if (!fs.existsSync(configurationPath)) {
          consola.error(
            `Cannot find ${chalk.cyan('configuration.ts')} in ${chalk.green(
              configurationPath
            )}`
          );
          process.exit(0);
        }

        const configurationSource =
          project.addSourceFileAtPath(configurationPath);

        addImportDeclaration(
          configurationSource,
          namespace,
          '@midwayjs/ws',
          ImportType.NAMESPACE_IMPORT
        );

        updateDecoratorArrayArgs(
          configurationSource,
          'Configuration',
          'imports',
          namespace
        );

        formatTSFile(configurationPath);

        addNPMScripts(path.resolve(projectDirPath, 'package.json'), [
          {
            script: scriptKey,
            content: scriptValue,
          },
        ]);

        consola.info(
          `NPM script added: { ${chalk.cyan(scriptKey)}: ${chalk.cyan(
            scriptValue
          )} }`
        );

        fs.ensureFileSync(generatedBootStrapPath);
        fs.writeFileSync(generatedBootStrapPath, outputBootStrapContent);

        consola.info(
          `WebSocket bootstrap file will be created: ${chalk.green(
            generatedBootStrapPath
          )}`
        );
      } else {
        consola.info('`[DryRun]` Source code will be transformed.');
        consola.info(
          `${chalk.cyan('[DryRun]')} NPM script will be added: { ${chalk.cyan(
            scriptKey
          )}: ${chalk.cyan(scriptValue)} }`
        );
        consola.info(
          `${chalk.cyan('[DryRun]')} File will be created: ${chalk.green(
            generatedBootStrapPath
          )}`
        );
      }

      break;

    case WebSocketGeneratorType.Controller:
      const dir = opts.dir ?? 'controller';

      const writeFileName = dotFile
        ? `${fileNameNames.fileName}.controller`
        : fileNameNames.fileName;

      const renderedControllerTemplate = EJSCompile(
        fs.readFileSync(
          path.join(__dirname, `../../templates/websocket/controller.ts.ejs`),
          { encoding: 'utf8' }
        ),
        {}
      )({
        name: nameNames.className,
      });

      const outputControllerContent = prettier.format(
        renderedControllerTemplate,
        {
          parser: 'typescript',
          singleQuote: true,
        }
      );

      const generatedControllerPath = path.resolve(
        path.resolve(projectDirPath, 'src', dir),
        `${writeFileName}.ts`
      );

      consola.info(
        `WebSocket Controller will be created in ${chalk.green(
          generatedControllerPath
        )}`
      );

      if (!dry) {
        fs.ensureFileSync(generatedControllerPath);

        fs.writeFileSync(generatedControllerPath, outputControllerContent);
      } else {
        consola.success('WebSocket generator invoked with:');
        consola.info(`Type: ${chalk.cyan(capitalCase(type))}`);
        consola.info(`Class Name: ${chalk.cyan(opts.class)}`);

        consola.info(`Dir: ${chalk.cyan(dir)}`);

        consola.info(
          `File will be created: ${chalk.green(generatedControllerPath)}`
        );
      }

      break;
  }
}

export default async function webSocketHandler(...args: unknown[]) {
  await generatorInvokeWrapper(webSocketHandlerCore, ...args);
}
