/*eslint no-case-declarations: 0*/
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
import { ensureDepsInstalled } from '../../lib/package';
import {
  addConstExport,
  updateDecoratorArrayArgs,
  addImportDeclaration,
  ImportType,
} from '../../lib/ast';
import { generatorInvokeWrapperExp } from '../../lib/wrapper';

import {
  GeneratorSharedOptions,
  sharedOption,
  applyTruthyDefaultValue,
  applyFalsyDefaultValue,
  ensureBooleanType,
  applyDefaultValueToSharedOption,
} from '../utils';
import pick from 'lodash/pick';
import { GeneratorCoreWrapperArgs } from '../../utils';

export interface ORMOptions extends GeneratorSharedOptions {
  /**
   * @description Import namespace for @midwayjs/orm import
   * @value axios
   */
  namespace: string;
  /**
   * @description Use Active-Record mode in entity class
   * @value true
   */
  activeRecord?: boolean;
  /**
   * @description Generate relation sample props in entity class
   * @value true
   */
  relation?: boolean;
  /**
   * @description Listen to transaction in subscriber class
   * @value true
   */
  transaction?: boolean;
  /**
   * @description Class identifier, works in entity / subscriber
   */
  class?: string;
}

export enum TypeORMGeneratorType {
  SETUP = 'setup',
  ENTITY = 'entity',
  SUBSCRIBER = 'subscriber',
}

export const DEFAULT_ENTITY_DIR_PATH = 'entity';
export const DEFAULT_SUBSCRIBER_DIR_PATH = 'entity/subscriber';
export const ORM_DEP = ['@midwayjs/orm', 'sqlite'];

export const WriterGenerator: TypeORMGeneratorType[] = [
  TypeORMGeneratorType.ENTITY,
  TypeORMGeneratorType.SUBSCRIBER,
];

export const mountORMCommand = (): ICommandInstance => {
  // TODO: 从接口中直接生成选项

  const writerSharedOptions = {
    class: {
      usage: 'Class identifier, works in entity / subscriber',
    },
  };

  return {
    orm: {
      usage: 'Generator for TypeORM setup or entity / subscriber generation',
      lifecycleEvents: ['gen'],
      commands: {
        setup: {
          usage: 'Generator for TypeORM setup',
          lifecycleEvents: ['gen'],
          opts: {
            // TODO: option: driver / orm config namespac
            ...pick(sharedOption, 'dry'),
            namespace: {
              usage: 'Import namespace for @midwayjs/orm import',
            },
          },
        },
        entity: {
          usage: 'Generate TypeORM entity',
          lifecycleEvents: ['gen'],
          opts: {
            ...sharedOption,
            ...writerSharedOptions,
            activeRecord: {
              usage: 'Use Active-Record mode in entity class',
            },
            relation: {
              usage:
                'Generate relation sample props & decorators in entity class',
            },
          },
        },
        subscriber: {
          usage: 'Generate TypeORM entity subscriber',
          lifecycleEvents: ['gen'],
          opts: {
            ...sharedOption,
            ...writerSharedOptions,
            transaction: {
              usage: 'Listen to transaction event in subscriber ckass',
            },
          },
        },
      },
    },
  };
};

async function ormHandlerCore({
  core: { cwd: projectDirPath },
  options: opts,
  type,
}: GeneratorCoreWrapperArgs<ORMOptions, TypeORMGeneratorType>) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

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
    ).type as TypeORMGeneratorType;
  }

  if (WriterGenerator.includes(type) && !opts.class) {
    consola.warn(`${capitalCase(type)} name cannot be empty!`);
    opts.class = await inputPromptStringValue(`${type} name`, 'sample');
  }

  const { dry, dotFile, override } = applyDefaultValueToSharedOption(opts);

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  // NOTE: If specified, will be either "true" (--activeRecord true) or true (--activeRecord)
  const activeRecord = opts.activeRecord
    ? ensureBooleanType(opts.activeRecord)
    : applyTruthyDefaultValue(opts.activeRecord);

  const relation = opts.relation
    ? ensureBooleanType(opts.relation)
    : applyTruthyDefaultValue(opts.relation);

  const transaction = opts.transaction
    ? ensureBooleanType(opts.transaction)
    : applyTruthyDefaultValue(opts.transaction);

  // TODO: modify names internal for skip
  const nameNames = names(opts.class ?? '__SKIP__');
  const fileNameNames = names(opts.file ?? opts.class ?? '__SKIP__');

  switch (type) {
    case TypeORMGeneratorType.SETUP:
      const { namespace = 'orm' } = opts;

      dry
        ? consola.info('`[DryRun]` Skip `dependencies` installation check.')
        : await ensureDepsInstalled(ORM_DEP, projectDirPath);

      if (!dry) {
        consola.info('Source code will be transformed.');

        const project = new Project();

        const configPath = path.resolve(
          projectDirPath,
          './src/config/config.default.ts'
        );

        if (!fs.existsSync(configPath)) {
          consola.error(
            `Cannot find ${chalk.cyan('configuration.ts')} in ${chalk.green(
              configPath
            )}.`
          );
          process.exit(0);
        }

        const configSource = project.addSourceFileAtPath(configPath);

        // 新增export const orm = {}
        addConstExport(configSource, 'orm', { type: 'sqlite' });

        formatTSFile(configPath);

        const configurationPath = path.resolve(
          projectDirPath,
          './src/configuration.ts'
        );

        if (!fs.existsSync(configurationPath)) {
          consola.error(
            `Cannot find ${chalk.cyan('configuration.ts')} in ${chalk.green(
              configurationPath
            )}.`
          );
          process.exit(0);
        }

        const configurationSource =
          project.addSourceFileAtPath(configurationPath);

        addImportDeclaration(
          configurationSource,
          namespace,
          '@midwayjs/orm',
          ImportType.NAMESPACE_IMPORT
        );

        updateDecoratorArrayArgs(
          configurationSource,
          'Configuration',
          'imports',
          namespace
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

      const writeFileName = dotFile
        ? `${fileNameNames.fileName}.${entityMode ? 'entity' : 'subscriber'}`
        : fileNameNames.fileName;

      const renderedTemplate = EJSCompile(
        fs.readFileSync(
          path.join(
            __dirname,
            `../../templates/typeorm/${
              entityMode
                ? relation
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
        activeRecord,
        subscriber: nameNames.className,
        transaction,
      });

      const outputContent = prettier.format(renderedTemplate, {
        parser: 'typescript',
        singleQuote: true,
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

      if (!dry) {
        fs.ensureFileSync(generatedPath);
        fs.writeFileSync(generatedPath, outputContent);
      } else {
        consola.success('TypeORM generator invoked with:');
        consola.info(`Type: ${chalk.cyan(capitalCase(type))}`);
        consola.info(`Class Name: ${chalk.cyan(opts.class)}`);

        if (type === TypeORMGeneratorType.ENTITY) {
          consola.info(`Active Record: ${chalk.cyan(activeRecord)}`);
          consola.info(`Relation: ${chalk.cyan(relation)}`);
        }

        if (type === TypeORMGeneratorType.SUBSCRIBER) {
          consola.info(`Transaction: ${chalk.cyan(transaction)}`);
        }

        consola.info(`Dot File: ${chalk.cyan(dotFile)}`);
        consola.info(`Dir: ${chalk.cyan(dir)}`);
        consola.info(`Generated File Name: ${chalk.cyan(writeFileName)}`);

        consola.info(`File will be created: ${chalk.green(generatedPath)}`);
      }

      break;
  }
}

const ormHandler: (
  arg: GeneratorCoreWrapperArgs<ORMOptions, TypeORMGeneratorType>
) => Promise<void> = async arg => {
  await generatorInvokeWrapperExp(ormHandlerCore, arg);
};

export default ormHandler;
