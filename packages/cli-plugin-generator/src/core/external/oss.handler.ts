import { ICommandInstance, ICoreInstance } from '@midwayjs/command-core';
import path from 'path';
import fs from 'fs-extra';
import consola from 'consola';
import chalk from 'chalk';
import { Project } from 'ts-morph';
import { formatTSFile } from '../../lib/helper';
import { ensureDepsInstalled, ensureDevDepsInstalled } from '../../lib/package';
import {
  updateDecoratorArrayArgs,
  addImportDeclaration,
  ImportType,
} from '../../lib/ast';
import { generatorInvokeWrapper } from '../../lib/wrapper';
import {
  GeneratorSharedOptions,
  sharedOption,
  applyDefaultValueToSharedOption,
} from '../utils';
import pick from 'lodash/pick';

export interface OSSOptions extends Pick<GeneratorSharedOptions, 'dry'> {
  /**
   * @description Import namespace for @midwayjs/oss import
   * @value axios
   */
  namespace: string;
}

export const OSS_DEP = ['@midwayjs/oss'];
export const OSS_DEV_DEP = ['@types/ali-oss'];

export const mountOSSCommand = (): ICommandInstance => {
  const writerSharedOptions = {
    namespace: {
      usage: 'Import namespace for @midwayjs/oss import',
    },
  };

  return {
    oss: {
      usage: 'Generator for @midwayjs/oss setup',
      lifecycleEvents: ['gen'],
      opts: {
        ...pick(sharedOption, ['dry']),
        ...writerSharedOptions,
      },
    },
  };
};

async function ossHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: OSSOptions
) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  const { dry } = applyDefaultValueToSharedOption(opts);
  const { namespace = 'oss' } = opts;

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  dry
    ? consola.info('`[DryRun]` Skip `dependencies` installation check.')
    : await ensureDepsInstalled(OSS_DEP, projectDirPath);

  dry
    ? consola.info('`[DryRun]` Skip `devDependencies` installation check.')
    : await ensureDevDepsInstalled(OSS_DEV_DEP, projectDirPath);

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
        )}.`
      );
      process.exit(0);
    }

    const configurationSource = project.addSourceFileAtPath(configurationPath);

    addImportDeclaration(
      configurationSource,
      namespace,
      '@midwayjs/oss',
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
}

export default async function ossHandler(...args: unknown[]) {
  await generatorInvokeWrapper(ossHandlerCore, ...args);
}
