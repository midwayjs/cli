import { ICommandInstance, ICoreInstance } from '@midwayjs/command-core';
import path from 'path';
import fs from 'fs-extra';
import consola from 'consola';
import chalk from 'chalk';
import { Project } from 'ts-morph';
import { formatTSFile } from '../../lib/helper';
import {
  ensureDepsInstalled,
  ensureDevDepsInstalled,
  addNPMScripts,
} from '../../lib/package';
import {
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
import execa from 'execa';

export interface PrismaOptions extends Pick<GeneratorSharedOptions, 'dry'> {
  /**
   * @description Generate initial prisma schema
   * @value true
   */
  initSchema: boolean;
  /**
   * @description Generate initial prisma client & database(sqlite3)
   * @value true
   */
  initClient: boolean;
}

const PRISMA_DEP = '@prisma/client';

const PRISMA_DEV_DEP = 'prisma';

const initialSchemaToAppend = `
      // This is your Prisma schema file,
      // learn more about it in the docs: https://pris.ly/d/prisma-schema

      datasource db {
        provider = "sqlite"
        url      = env("DATABASE_URL")
      }

      generator client {
        provider        = "prisma-client-js"
        output          = "./client"
      }

      model PrismaSampleModel {
        id      Int @id @default(autoincrement())
        version Int @default(2)

        createdAt DateTime @default(now())
      }
    `;

const envPairToAppend = `DATABASE_URL="file:../../demo.sqlite"`;

export const mountPrismaCommand = (): ICommandInstance => {
  // TODO: 从接口中直接生成选项

  const writerSharedOptions = {
    initSchema: {
      usage: 'Generate initial prisma schema',
    },
    initClient: {
      usage: 'Generate initial prisma client & database(sqlite3)',
    },
  };

  return {
    prisma: {
      usage: 'prisma genrator',
      lifecycleEvents: ['gen'],
      opts: {
        ...pick(sharedOption, ['dry']),
        ...writerSharedOptions,
      },
    },
  };
};

export async function prismaHandlerCore(
  { cwd: projectDirPath }: ICoreInstance,
  opts: PrismaOptions
) {
  consola.warn(
    'Prisma generator is still experimental. Use `--dry` option to avoid incorrect execution.'
  );
  consola.info(`Project location: ${chalk.green(projectDirPath)}`);

  const { dry } = applyDefaultValueToSharedOption(opts);

  const initSchema = opts.initSchema
    ? ensureBooleanType(opts.initSchema)
    : applyTruthyDefaultValue(opts.initSchema);

  const initClient = opts.initClient
    ? ensureBooleanType(opts.initClient)
    : applyTruthyDefaultValue(opts.initClient);

  if (dry) {
    consola.success('Executing in `dry run` mode, nothing will happen.');
  }

  if (initClient && !initSchema) {
    consola.error('`--initClient` requires `--initSchema` to be enabled.');
    process.exit(0);
  }

  dry
    ? consola.info('`[DryRun]` Skip dependencies installation check.')
    : await ensureDepsInstalled(PRISMA_DEP, projectDirPath);

  dry
    ? consola.info('`[DryRun]` Skip dependencies installation check.')
    : await ensureDevDepsInstalled(PRISMA_DEV_DEP, projectDirPath);

  // 执行prisma init
  // 添加npm script
  // initSchema -> 写入初始内容 -> prisma format
  // initClien -> prisma db push + prisma generate
  // 修改configuration

  if (!dry) {
    consola.info('Executing command `prisma init` under project.');
    // TODO: 把.env移动到src同级
    await execa('prisma init', {
      cwd: path.resolve(projectDirPath, 'src'),
      stdio: 'inherit',
      preferLocal: true,
      shell: true,
    });
    consola.success('Command `prisma init` succeed...');

    const prismaSchemaPath = path.resolve(
      projectDirPath,
      'src',
      'prisma/schema.prisma'
    );

    // try catch!

    if (initSchema) {
      consola.info('Appending initial `Prisma Schema` content...');
      fs.writeFileSync(prismaSchemaPath, initialSchemaToAppend);
      // TODO: ENV 相关
      consola.info('Initial `Prisma Schema` append successfully');
    }

    consola.info('Adding `Prisma` related npm scripts...');

    addNPMScripts(path.resolve(projectDirPath, 'package.json'), [
      {
        script: 'prisma:gen',
        content: 'prisma generate --schema=./src/prisma/schema.prisma',
      },
      {
        script: 'prisma:push',
        content: 'prisma db push --schema=./src/prisma/schema.prisma',
      },
      {
        script: 'prisma:pull',
        content: 'prisma db pull --schema=./src/prisma/schema.prisma',
      },
      {
        script: 'prisma:migrate',
        content:
          'prisma migrate --preview-feature --schema=./src/prisma/schema.prisma',
      },
      {
        script: 'prisma:format',
        content: 'prisma format --schema=./src/prisma/schema.prisma',
      },
    ]);

    consola.success('Prisma related npm scripts added.');

    consola.info('Executing command `prisma format` under project.');
    await execa('npm run prisma:format', {
      cwd: projectDirPath,
      stdio: 'inherit',
      preferLocal: true,
      shell: true,
    });
    consola.success('Command `prisma format` succeed...');

    if (initClient) {
      consola.info('Initializing `Prisma Client`...');
      consola.info('Executing command `npm run prisma:push` under project.');
      consola.info(
        'This command will also execute `Prisma Client` generation.'
      );

      await execa('npm run prisma:push', {
        cwd: projectDirPath,
        stdio: 'inherit',
        preferLocal: true,
        shell: true,
      });
      consola.success('Command `npm run prisma:push` succeed...');
    }

    consola.info('Executing `Prisma Client` related code transform...');

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

    consola.info('Adding import statement from `Prisma Client`');

    const configurationSource = project.addSourceFileAtPath(configurationPath);

    addImportDeclaration(
      configurationSource,
      ['PrismaClient'],
      '@prisma/client',
      ImportType.NAMED_IMPORTS
    );

    // TODO: 相关实例化、注册语句

    formatTSFile(configurationPath);
  } else {
    consola.info('`[DryRun]` Source code will be transformed.');
  }
}

export async function prismaHandler(...args: unknown[]) {
  await generatorInvokeWrapper(prismaHandlerCore, ...args);
}
