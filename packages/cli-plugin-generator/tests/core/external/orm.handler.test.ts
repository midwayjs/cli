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
import {
  ORM_DEP,
  DEFAULT_ENTITY_DIR_PATH,
  DEFAULT_SUBSCRIBER_DIR_PATH,
  TypeORMGeneratorType,
} from '../../../src/core/external/orm.handler';

describe.skip('ORM handler (setup)', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
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

describe.skip('ORM handler (entity)', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  const sharedClassIdentifier = 'tmp';
  const sharedFileName = 'entity-file';
  const sharedDirName = 'entity-dir';

  it('should use option passed in (--dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
      dotFile: true,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_ENTITY_DIR_PATH,
      `${sharedClassIdentifier}.entity.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
      dotFile: true,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_ENTITY_DIR_PATH,
      `${sharedClassIdentifier}.entity.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
      dotFile: true,
      file: sharedFileName,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_ENTITY_DIR_PATH,
      `${sharedFileName}.entity.ts`
    );
    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
      dotFile: false,
      file: sharedFileName,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_ENTITY_DIR_PATH,
      `${sharedFileName}.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dir `sharedDirName` --dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
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
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
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
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
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
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
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

  it('should use option passed in (--dir `sharedDirName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
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

  it('should use option passed in (--activeRecord relation --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
      class: sharedClassIdentifier,
      activeRecord: true,
      relation: true,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_ENTITY_DIR_PATH,
      `${sharedClassIdentifier}.entity.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);

    expect(
      fs
        .readFileSync(generatedEntityPath, { encoding: 'utf-8' })
        .includes('BaseEntity')
    ).toBeTruthy();

    for (const relationType of [
      '@OneToOne',
      '@JoinColumn',
      '@ManyToOne',
      '@OneToMany',
      '@ManyToMany',
    ]) {
      expect(
        fs
          .readFileSync(generatedEntityPath, { encoding: 'utf-8' })
          .includes(relationType)
      ).toBeTruthy();
    }
  });

  it('should not actually work in dry run mode (--activeRecord relation --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
      dry: true,
      class: sharedClassIdentifier,
      activeRecord: true,
      relation: true,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_ENTITY_DIR_PATH,
      `${sharedClassIdentifier}.entity.ts`
    );

    expect(fs.existsSync(generatedEntityPath)).toBeFalsy();
  });

  it('should not actually work in dry run mode (--dry --dir `sharedDirName` --file `sharedFileName` --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
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
    await core.invoke(['gen', 'orm', TypeORMGeneratorType.ENTITY], undefined, {
      dry: true,
      class: sharedClassIdentifier,
    });

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_ENTITY_DIR_PATH,
      `${sharedClassIdentifier}.entity.ts`
    );

    expect(fs.existsSync(generatedEntityPath)).not.toBeTruthy();
  });
});

describe.skip('ORM handler (subscriber)', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  const sharedClassIdentifier = 'tmp';
  const sharedFileName = 'subscriber-file';
  const sharedDirName = 'subscriber-dir';

  it('should use option passed in (--dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dotFile: true,
        class: sharedClassIdentifier,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_SUBSCRIBER_DIR_PATH,
      `${sharedClassIdentifier}.subscriber.ts`
    );

    expectGenerateValidFile(generatedSubscriberPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dotFile: true,
        class: sharedClassIdentifier,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_SUBSCRIBER_DIR_PATH,
      `${sharedClassIdentifier}.subscriber.ts`
    );

    expectGenerateValidFile(generatedSubscriberPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dotFile: true,
        file: sharedFileName,
        class: sharedClassIdentifier,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_SUBSCRIBER_DIR_PATH,
      `${sharedFileName}.subscriber.ts`
    );
    expectGenerateValidFile(generatedSubscriberPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dotFile: false,
        file: sharedFileName,
        class: sharedClassIdentifier,
      }
    );

    const generatedEntityPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_SUBSCRIBER_DIR_PATH,
      `${sharedFileName}.ts`
    );

    expectGenerateValidFile(generatedEntityPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dir `sharedDirName` --dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dotFile: true,
        dir: sharedDirName,
        class: sharedClassIdentifier,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedClassIdentifier}.subscriber.ts`
    );

    expectGenerateValidFile(generatedSubscriberPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dir `sharedDirName` --dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dotFile: true,
        file: sharedFileName,
        dir: sharedDirName,
        class: sharedClassIdentifier,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.subscriber.ts`
    );

    expectGenerateValidFile(generatedSubscriberPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dir `sharedDirName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dotFile: false,
        file: sharedFileName,
        dir: sharedDirName,
        class: sharedClassIdentifier,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.ts`
    );

    expectGenerateValidFile(generatedSubscriberPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dir `sharedDirName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dotFile: false,
        dir: sharedDirName,
        class: sharedClassIdentifier,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedClassIdentifier}.ts`
    );

    expectGenerateValidFile(generatedSubscriberPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dir `sharedDirName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dotFile: false,
        dir: sharedDirName,
        class: sharedClassIdentifier,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedClassIdentifier}.ts`
    );

    expectGenerateValidFile(generatedSubscriberPath, sharedClassIdentifier);
  });

  it('should use option passed in (--transaction true --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        class: sharedClassIdentifier,
        transaction: true,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_SUBSCRIBER_DIR_PATH,
      `${sharedClassIdentifier}.subscriber.ts`
    );

    expectGenerateValidFile(generatedSubscriberPath, sharedClassIdentifier);

    for (const transactionType of [
      'TransactionStartEvent',
      'TransactionCommitEvent',
      'TransactionRollbackEvent',
    ]) {
      expect(
        fs
          .readFileSync(generatedSubscriberPath, { encoding: 'utf-8' })
          .includes(transactionType)
      ).toBeTruthy();
    }
  });

  it('should not actually work in dry run mode (--transaction true --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dry: true,
        class: sharedClassIdentifier,
        transaction: true,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_ENTITY_DIR_PATH,
      `${sharedClassIdentifier}.subscriber.ts`
    );

    expect(fs.existsSync(generatedSubscriberPath)).not.toBeTruthy();
  });

  it('should not actually work in dry run mode (--dry --dir `sharedDirName` --file `sharedFileName` --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dry: true,
        dir: sharedDirName,
        file: sharedFileName,
        class: sharedClassIdentifier,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.subscriber.ts`
    );

    expect(fs.existsSync(generatedSubscriberPath)).not.toBeTruthy();
  });

  it('should not actually work in dry run mode (--dry --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(
      ['gen', 'orm', TypeORMGeneratorType.SUBSCRIBER],
      undefined,
      {
        dry: true,
        class: sharedClassIdentifier,
      }
    );

    const generatedSubscriberPath = path.resolve(
      baseDir,
      'src',
      DEFAULT_SUBSCRIBER_DIR_PATH,
      `${sharedClassIdentifier}.subscriber.ts`
    );

    expect(fs.existsSync(generatedSubscriberPath)).not.toBeTruthy();
  });
});
