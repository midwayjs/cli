import fs from 'fs-extra';
import jsonfile from 'jsonfile';
import path from 'path';
import {
  resetFixtures,
  createGeneratorCommand,
  configPath,
  configurationPath,
  packagePath,
  baseDir,
  expectGenerateValidFile,
} from '../../shared';
import { SLSType } from '../../../src/core/utils';

describe('Serverless handler', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  const sharedClassIdentifier = 'sample';
  const sharedFaaSFileName = 'faas-file';
  const sharedFaaSDirName = 'faas-dir';
  const sharedAggrFileName = 'aggr-file';
  const sharedAggrDirName = 'aggr-dir';

  it('should use faas, with only http trigger by default', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'sls'], undefined, {
      class: sharedClassIdentifier,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'functions',
      `${sharedClassIdentifier}.ts`
    );

    expectGenerateValidFile(generatedFilePath, sharedClassIdentifier);

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.HTTP')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.EVENT')
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.API_GATEWAY')
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.TIMER')
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.OS')
    ).not.toBeTruthy();
  });

  it('should not include trigger when use aggr mode', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'sls'], undefined, {
      class: sharedClassIdentifier,
      type: 'aggr',
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'controller',
      `${sharedClassIdentifier}.ts`
    );

    expectGenerateValidFile(generatedFilePath, sharedClassIdentifier);

    expect(
      fs.readFileSync(generatedFilePath, { encoding: 'utf8' }).includes('@Get')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.HTTP')
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.EVENT')
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.API_GATEWAY')
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.TIMER')
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.OS')
    ).not.toBeTruthy();
  });

  it('should apply faas when received invalid type', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'sls'], undefined, {
      class: sharedClassIdentifier,
      type: 'foo',
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'functions',
      `${sharedClassIdentifier}.ts`
    );

    expectGenerateValidFile(generatedFilePath, sharedClassIdentifier);

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.HTTP')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.EVENT')
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.API_GATEWAY')
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.TIMER')
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.OS')
    ).not.toBeTruthy();
  });

  it('should use trigger by options', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'sls'], undefined, {
      class: sharedClassIdentifier,
      http: false,
      event: true,
      gateway: true,
      timer: true,
      oss: true,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'functions',
      `${sharedClassIdentifier}.ts`
    );

    expectGenerateValidFile(generatedFilePath, sharedClassIdentifier);

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.HTTP')
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.EVENT')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.API_GATEWAY')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.TIMER')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('ServerlessTriggerType.OS')
    ).toBeTruthy();
  });

  it('should not actually work in dry run mode (--type faas)', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'sls'], undefined, {
      class: sharedClassIdentifier,
      dry: true,
      http: false,
      event: true,
      gateway: true,
      timer: true,
      oss: true,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'functions',
      `${sharedClassIdentifier}.ts`
    );

    expect(fs.existsSync(generatedFilePath)).not.toBeTruthy();
  });

  it('should not actually work in dry run mode (--type aggr)', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'sls'], undefined, {
      class: sharedClassIdentifier,
      dry: true,
      type: 'aggr',
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'controller',
      `${sharedClassIdentifier}.ts`
    );

    expect(fs.existsSync(generatedFilePath)).not.toBeTruthy();
  });
});
