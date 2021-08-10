import fs from 'fs-extra';
import jsonfile from 'jsonfile';
import {
  resetFixtures,
  createGeneratorCommand,
  configurationPath,
  packagePath,
} from '../../shared';
import {
  CACHE_DEP,
  CACHE_DEV_DEP,
} from '../../../src/core/external/cache.handler';

describe('Cache handler', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  it('should install required deps only', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'cache']);

    const pkg = jsonfile.readFileSync(packagePath);

    expect(Object.keys(pkg?.dependencies ?? {})).toEqual(CACHE_DEP);
    expect(Object.keys(pkg?.devDependencies ?? {})).toEqual(CACHE_DEV_DEP);
  });

  it('should transform source code', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'cache']);

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as cache from "@midwayjs/cache"')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[cache]')
    ).toBeTruthy();
  });

  it('should use specified namespace', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'cache'], undefined, {
      namespace: 'cacheMod',
    });

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as cacheMod from "@midwayjs/cache"')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[cacheMod]')
    ).toBeTruthy();
  });

  it('should not actually work in dry run mode', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'cache'], undefined, {
      dry: true,
    });
    const pkg = jsonfile.readFileSync(packagePath);

    expect(Object.keys(pkg?.dependencies ?? {})).not.toEqual(CACHE_DEP);
    expect(Object.keys(pkg?.devDependencies ?? {})).not.toEqual(CACHE_DEV_DEP);

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as cache from "@midwayjs/cache"')
    ).toBeFalsy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[cache]')
    ).toBeFalsy();
  });
});
