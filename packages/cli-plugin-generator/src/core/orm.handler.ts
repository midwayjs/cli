import {
  BasePlugin,
  ICommandInstance,
  ICoreInstance,
  IPluginCommands,
  IPluginHooks,
} from '@midwayjs/command-core';

import path from 'path';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import consola from 'consola';
import chalk from 'chalk';
import findUp from 'find-up';
import { compile as EJSCompile } from 'ejs';
import { Project } from 'ts-morph';

import prettier from 'prettier';
import {
  ensureBooleanType,
  inputPromptStringValue,
  formatTSFile,
  names,
  updateGitIgnore,
} from '../lib/helper';

import { capitalCase } from '../lib/case';
import { ensureDepsInstalled } from '../lib/package';
import {
  addConstExport,
  updateDecoratorArrayArgs,
  addImportDeclaration,
  ImportType,
} from '../lib/ast';
import { generatorInvokeWrapper } from '../lib/wrapper';

export enum TypeORMGeneratorType {
  SETUP = 'setup',
  ENTITY = 'entity',
  SUBSCRIBER = 'subscriber',
}

export interface ORMOptions {
  activeRecord: boolean;
  relation: boolean;
  transaction: boolean;
  dry: boolean;
  // work in entity / subscriber
  class: string;
  dotFile: boolean;
  override: boolean;
  file: string;
  dir: string;
}

const DEFAULT_ENTITY_DIR_PATH = 'entity';
const DEFAULT_SUBSCRIBER_DIR_PATH = 'entity/subscriber';
const ORM_PKG = ['@midwayjs/orm', 'sqlite'];

export const mountORMCommand = (): ICommandInstance => {
  // TODO: 从接口中直接生成选项

  return {
    orm: {
      usage: 'controller genrator',
      lifecycleEvents: ['gen'],
      commands: {
        setup: {
          lifecycleEvents: ['gen'],
          opts: {
            dry: {
              usage: '',
            },
            class: {
              usage: '',
            },
            dotFile: { usage: '' },
            override: { usage: '' },
            file: { usage: '' },
            dir: { usage: '' },
            light: { usage: '' },
          },
        },
      },
    },
  };
};

export async function ormHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: ORMOptions,
  type: TypeORMGeneratorType
) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  // undefined type -> prompt
  if (!type) {
    consola.info('Choose generator type:');
    type = (
      await inquirer.prompt([
        {
          name: 'type',
          type: 'list',
          choices: ['setup', 'entity', 'subscriber'] as TypeORMGeneratorType[],
        },
      ])
    ).type;
  }

  if (['entity', 'subscriber'].includes(type) && !opts.class) {
    consola.warn(`${capitalCase(type)} name cannot be empty!`);
    opts.class = await inputPromptStringValue(`${type} name`, 'sample');
  }

  opts.dotFile = opts.dotFile ?? true;
  opts.dry = opts.dry ?? false;
  opts.override = opts.override ?? false;
  opts.activeRecord = opts.activeRecord ?? true;
  opts.relation = opts.relation ?? false;
  opts.transaction = opts.transaction ?? true;

  // modify names internal
  const nameNames = names(opts.class ?? '__SKIP__');
  const fileNameNames = names(opts.file ?? opts.class ?? '__SKIP__');

  switch (type) {
    case TypeORMGeneratorType.SETUP:
      opts.dry
        ? consola.info('`[DryRun]` Skip dependencies installation check.')
        : await ensureDepsInstalled(ORM_PKG, projectDirPath);

      const project = new Project();

      const configPath = path.resolve(
        projectDirPath,
        './src/config/config.default.ts'
      );

      const configSource = project.addSourceFileAtPath(configPath);

      const configurationPath = path.resolve(
        projectDirPath,
        './src/configuration.ts'
      );

      if (!opts.dry) {
        consola.info('Source code will be transformed.');
        // 新增export const orm = {}
        addConstExport(configSource, 'orm', { type: 'sqlite' });

        formatTSFile(configPath);

        const configurationSource =
          project.addSourceFileAtPath(configurationPath);

        addImportDeclaration(
          configurationSource,
          'orm',
          '@midwayjs/orm',
          ImportType.NAMESPACE_IMPORT
        );

        updateDecoratorArrayArgs(
          configurationSource,
          'Configuration',
          'imports',
          'orm'
        );

        formatTSFile(configurationPath);
      } else {
        consola.info('`[DryRun]` Source code will be transformed.');
      }

      break;

    case TypeORMGeneratorType.ENTITY:
    case TypeORMGeneratorType.SUBSCRIBER:
      const entityMode = type === TypeORMGeneratorType.ENTITY;

      const dir = path.resolve(
        projectDirPath,
        'src',
        opts.dir
          ? opts.dir
          : entityMode
          ? DEFAULT_ENTITY_DIR_PATH
          : DEFAULT_SUBSCRIBER_DIR_PATH
      );

      // use functions?
      const writeFileName = opts.dotFile
        ? `${fileNameNames.fileName}.${entityMode ? 'entity' : 'subscriber'}`
        : fileNameNames.fileName;

      const renderedTemplate = EJSCompile(
        fs.readFileSync(
          path.join(
            __dirname,
            `../templates/typeorm/${
              entityMode
                ? opts.relation
                  ? 'relation-entity.ts.ejs'
                  : 'plain-entity.ts.ejs'
                : 'subscriber.ts.ejs'
            }`
          ),
          { encoding: 'utf8' }
        ),
        {}
      )({
        entity: nameNames.className,
        activeRecord: opts.activeRecord,
        subscriber: nameNames.className,
        transaction: opts.transaction,
      });

      const outputContent = prettier.format(renderedTemplate, {
        parser: 'typescript',
      });

      const generatedPath = path.resolve(
        path.resolve(projectDirPath, 'src', dir),
        `${writeFileName}.ts`
      );

      consola.info(
        `${chalk.cyan(
          entityMode ? 'Entity' : 'Subscriber'
        )} will be created in ${chalk.green(generatedPath)}`
      );

      if (!opts.dry) {
        fs.ensureFileSync(generatedPath);
        fs.writeFileSync(generatedPath, outputContent);
      } else {
        consola.success('TypeORM generator invoked with:');
        consola.info(`type: ${chalk.cyan(capitalCase(type))}`);
        consola.info(`name: ${chalk.cyan(opts.class)}`);

        if (type === TypeORMGeneratorType.ENTITY) {
          consola.info(`active record: ${chalk.cyan(opts.activeRecord)}`);
          consola.info(`relation: ${chalk.cyan(opts.relation)}`);
        }

        if (type === TypeORMGeneratorType.SUBSCRIBER) {
          consola.info(`transaction: ${chalk.cyan(opts.transaction)}`);
        }

        consola.info(`dot name: ${chalk.cyan(opts.dotFile)}`);

        consola.info(`dir: ${chalk.cyan(dir)}`);
        consola.info(`file name: ${chalk.cyan(fileNameNames.fileName)}`);
        opts.dir && consola.info(`dir: ${chalk.cyan(opts.dir)}`);

        consola.info(`File will be created: ${chalk.green(generatedPath)}`);
      }

      break;
  }
}

export async function ormHandler(...args: unknown[]) {
  await generatorInvokeWrapper(ormHandlerCore, ...args);
}
