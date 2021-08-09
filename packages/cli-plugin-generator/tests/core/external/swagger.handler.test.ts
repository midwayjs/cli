import fs from 'fs-extra';
import jsonfile from 'jsonfile';
import {
  resetFixtures,
  createGeneratorCommand,
  configPath,
  configurationPath,
  packagePath,
  baseDir,
} from '../../shared';
import {
  SWAGGER_DEP,
  SWAGGER_DEV_DEP,
} from '../../../src/core/external/swagger.handler';

describe.skip('Swagger handler', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  it('should install required deps only', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'swagger']);

    const pkg = jsonfile.readFileSync(packagePath);

    expect(Object.keys(pkg?.dependencies ?? {})).toEqual(SWAGGER_DEP);
    expect(Object.keys(pkg?.devDependencies ?? {})).toEqual(SWAGGER_DEV_DEP);
  });

  it('should transform source code', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'swagger']);

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as swagger from "@midwayjs/swagger"')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[swagger]')
    ).toBeTruthy();
  });

  it('should use specified namespace', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'swagger'], undefined, {
      namespace: 'swaggerMod',
    });

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as swaggerMod from "@midwayjs/swagger"')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[swaggerMod]')
    ).toBeTruthy();
  });

  it('should not actually work in dry run mode', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'swagger'], undefined, {
      dry: true,
    });
    const pkg = jsonfile.readFileSync(packagePath);

    expect(Object.keys(pkg?.dependencies ?? {})).not.toEqual(SWAGGER_DEP);
    expect(Object.keys(pkg?.devDependencies ?? {})).not.toEqual(
      SWAGGER_DEV_DEP
    );

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as swagger from "@midwayjs/swagger"')
    ).toBeFalsy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[swagger]')
    ).toBeFalsy();
  });
});
