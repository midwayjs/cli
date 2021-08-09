import fs from 'fs-extra';
import path from 'path';
import jsonfile from 'jsonfile';
import prettier from 'prettier';
import {
  resetFixtures,
  createGeneratorCommand,
  configPath,
  configurationPath,
  packagePath,
  baseDir,
} from '../../shared';
import {
  envPairToAppend,
  initialSchemaToAppend,
  updateGitIgnore,
  PRISMA_DEP,
  PRISMA_DEV_DEP,
  PRISMA_NPM_SCRIPTS,
} from '../../../src/core/external/prisma.handler';

describe.only('Prisma handler', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  it('should perform preparation', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'prisma']);

    const pkg = jsonfile.readFileSync(packagePath);

    // deps required
    expect(Object.keys(pkg?.dependencies ?? {})).toEqual(PRISMA_DEP);
    expect(Object.keys(pkg?.devDependencies ?? {})).toEqual(PRISMA_DEV_DEP);

    // npm script
    for (const { script, content } of PRISMA_NPM_SCRIPTS) {
      expect(Object.keys(pkg?.scripts ?? {}).includes(script)).toBeTruthy();
      expect(Object.values(pkg?.scripts ?? {}).includes(content)).toBeTruthy();
    }

    const correctDotEnvPath = path.resolve(baseDir, '.env');
    const initialGeneratedDotEnvPath = path.resolve(baseDir, 'src', '.env');
    const gitIgnorePath = path.resolve(baseDir, '.gitignore');
    const correctPrismaDirPath = path.resolve(baseDir, 'src', 'prisma');
    const rootLevelPrismaDirPath = path.resolve(baseDir, 'prisma');

    const prismaSchemaPath = path.resolve(
      correctPrismaDirPath,
      'schema.prisma'
    );

    const prismaClientPath = path.resolve(
      baseDir,
      'node_modules',
      '@prisma/client'
    );

    // .env
    expect(fs.existsSync(correctDotEnvPath)).toBeTruthy();
    expect(fs.existsSync(initialGeneratedDotEnvPath)).not.toBeTruthy();
    expect(
      fs
        .readFileSync(correctDotEnvPath, { encoding: 'utf-8' })
        .includes(envPairToAppend)
    );

    // .gitignore
    expect(fs.existsSync(gitIgnorePath)).toBeTruthy();
    expect(
      fs
        .readFileSync(gitIgnorePath, { encoding: 'utf-8' })
        .includes(updateGitIgnore)
    );

    // prisma folder
    expect(fs.existsSync(correctPrismaDirPath)).toBeTruthy();
    expect(fs.statSync(correctPrismaDirPath).isDirectory()).toBeTruthy();
    expect(fs.existsSync(rootLevelPrismaDirPath)).not.toBeTruthy();
    // schema + client
    expect(fs.readdirSync(correctPrismaDirPath).length).toBe(2);
    expect(fs.readdirSync(correctPrismaDirPath)).toContain('schema.prisma');

    // initial schema
    expect(fs.existsSync(prismaSchemaPath)).toBeTruthy();
    expect(
      fs
        .readFileSync(prismaSchemaPath, { encoding: 'utf-8' })
        .replace(new RegExp(/\s*/g), '')
        .includes(initialSchemaToAppend.replace(new RegExp(/\s*/g), ''))
    ).toBeTruthy();

    // generated Prisma Client
    expect(fs.existsSync(prismaClientPath)).toBeTruthy();
    expect(fs.statSync(prismaClientPath).isDirectory()).toBeTruthy();
    expect(fs.readdirSync(correctPrismaDirPath).length).toBeGreaterThan(0);

    // import
    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import { PrismaClient } from "@prisma/client"')
    ).toBeTruthy();

    // instance
    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('const client = new PrismaClient()')
    ).toBeTruthy();

    // app

    console.log(
      fs.readFileSync(configurationPath, {
        encoding: 'utf-8',
      })
    );

    // register
    expect(
      prettier
        .format(
          fs.readFileSync(configurationPath, {
            encoding: 'utf-8',
          }),
          { parser: 'typescript', singleQuote: true }
        )
        .includes(
          "this.app.getApplicationContext().registerObject('prisma', client);"
        )
    ).toBeTruthy();

    // connect
    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('client.$connect();')
    ).toBeTruthy();
  });
});
