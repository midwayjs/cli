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

export interface CacheOptions extends Pick<GeneratorSharedOptions, 'dry'> {}

const CACHE_DEP = ['@midwayjs/cache', 'cache-manager'];
const CACHE_DEV_DEP = ['@types/cache-manager'];

export const mountCacheCommand = (): ICommandInstance => {
  // TODO: 从接口中直接生成选项

  const writerSharedOptions = {};

  return {
    cache: {
      usage: 'cache genrator',
      lifecycleEvents: ['gen'],
      opts: {
        ...pick(sharedOption, ['dry']),
        ...writerSharedOptions,
      },
    },
  };
};

async function cacheHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: CacheOptions
) {
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  const { dry } = applyDefaultValueToSharedOption(opts);
  const {} = opts;

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  dry
    ? consola.info('`[DryRun]` Skip dependencies installation check.')
    : await ensureDepsInstalled(CACHE_DEP, projectDirPath);

  dry
    ? consola.info('`[DryRun]` Skip devDependencies installation check.')
    : await ensureDevDepsInstalled(CACHE_DEV_DEP, projectDirPath);

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

    const configurationSource = project.addSourceFileAtPath(configurationPath);

    addImportDeclaration(
      configurationSource,
      'cache',
      '@midwayjs/cache',
      ImportType.NAMESPACE_IMPORT
    );

    updateDecoratorArrayArgs(
      configurationSource,
      'Configuration',
      'imports',
      'cache'
    );

    formatTSFile(configurationPath);
  } else {
    consola.info('`[DryRun]` Source code will be transformed.');
  }
}

export default async function cacheHandler(...args: unknown[]) {
  await generatorInvokeWrapper(cacheHandlerCore, ...args);
}
