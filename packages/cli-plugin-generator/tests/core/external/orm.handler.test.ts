import fs from 'fs-extra';
import path from 'path';
import jsonfile from 'jsonfile';
import {
  resetFixtures,
  createGeneratorCommand,
  configPath,
  configurationPath,
  packagePath,
  baseDir,
  expectGenerateValidFile,
} from '../../shared';
import { ORM_DEP } from '../../../src/core/external/orm.handler';

describe('ORM handler (setup)', () => {
  beforeAll(() => {
    jest.setTimeout(300000);
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  it('should install required deps only', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'setup']);

    const pkg = jsonfile.readFileSync(packagePath);

    expect(Object.keys(pkg?.dependencies ?? {})).toEqual(ORM_DEP);
  });

  it('should transform source code', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'orm', 'setup']);

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as orm from "@midwayjs/orm"')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[orm]')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(configPath, {
          encoding: 'utf-8',
        })
        .includes('export const orm = { type: "sqlite" }')
    ).toBeTruthy();
  });

  it('should use specified namespace', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'setup'], undefined, {
      namespace: 'ormMod',
    });

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as ormMod from "@midwayjs/orm"')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[ormMod]')
    ).toBeTruthy();
  });

  it('should not actually work in dry run mode', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'setup'], undefined, {
      dry: true,
    });

    expect(
      fs.existsSync(path.resolve(baseDir, 'orm-bootstrap.js'))
    ).toBeFalsy();

    const pkg = jsonfile.readFileSync(packagePath);

    expect(Object.keys(pkg?.dependencies ?? {})).not.toEqual(ORM_DEP);

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as orm from "@midwayjs/orm"')
    ).toBeFalsy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[orm]')
    ).toBeFalsy();
  });
});

describe('WebSocket handler (entity)', () => {
  beforeAll(() => {
    jest.setTimeout(300000);
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  const sharedClassIdentifier = 'tmp';
  const sharedFileName = 'orm-file';
  const sharedDirName = 'orm-dir';

  it('should use option passed in (--dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'entity'], undefined, {
      dotFile: true,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      'entity',
      `${sharedClassIdentifier}.entity.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'entity'], undefined, {
      dotFile: true,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      'entity',
      `${sharedClassIdentifier}.entity.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'entity'], undefined, {
      dotFile: true,
      file: sharedFileName,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      'entity',
      `${sharedFileName}.entity.ts`
    );
    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'entity'], undefined, {
      dotFile: false,
      file: sharedFileName,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      'entity',
      `${sharedFileName}.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dir `sharedDirName` --dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'entity'], undefined, {
      dotFile: true,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedClassIdentifier}.entity.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dir `sharedDirName` --dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'entity'], undefined, {
      dotFile: true,
      file: sharedFileName,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.entity.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dir `sharedDirName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'entity'], undefined, {
      dotFile: false,
      file: sharedFileName,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dir `sharedDirName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'entity'], undefined, {
      dotFile: false,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedClassIdentifier}.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should not actually work in dry run mode (--dry --dir `sharedDirName` --file `sharedFileName` --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'entity'], undefined, {
      dry: true,
      dir: sharedDirName,
      file: sharedFileName,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.entity.ts`
    );

    expect(fs.existsSync(generatedEntityPath)).not.toBeTruthy();
  });

  it('should not actually work in dry run mode (--dry --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', 'entity'], undefined, {
      dry: true,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      'entity',
      `${sharedClassIdentifier}.entity.ts`
    );

    expect(fs.existsSync(generatedEntityPath)).not.toBeTruthy();
  });
});
