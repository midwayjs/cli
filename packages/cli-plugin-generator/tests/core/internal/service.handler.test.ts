import fs from 'fs-extra';
import path from 'path';
import jsonfile from 'jsonfile';
import { capitalCase } from 'capital-case';
import {
  resetFixtures,
  createGeneratorCommand,
  configPath,
  configurationPath,
  packagePath,
  baseDir,
  expectGenerateValidFile,
} from '../../shared';

describe.only('Service handler', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  const sharedClassIdentifier = 'sample';
  const sharedFileName = 'service-file';
  const sharedDirName = 'service-dir';

  it('should create files', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'service'], undefined, {
      class: sharedClassIdentifier,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'service',
      `${sharedClassIdentifier}.service.ts`
    );

    expectGenerateValidFile(generatedFilePath, sharedClassIdentifier);
  });

  it('should use option passed in (--file --dir)', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'service'], undefined, {
      class: sharedClassIdentifier,
      file: sharedFileName,
      dir: sharedDirName,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.service.ts`
    );

    expectGenerateValidFile(generatedFilePath, sharedClassIdentifier);
  });

  it('should use option passed in (--file --dir --dot false)', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'service'], undefined, {
      dotFile: false,
      class: sharedClassIdentifier,
      file: sharedFileName,
      dir: sharedDirName,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.ts`
    );

    expectGenerateValidFile(generatedFilePath, sharedClassIdentifier);
  });

  it('should not actually work in dry run mode', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'service'], undefined, {
      dotFile: false,
      class: sharedClassIdentifier,
      file: sharedFileName,
      dir: sharedDirName,
      dry: true,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedClassIdentifier}.ts`
    );

    expect(fs.existsSync(generatedFilePath)).not.toBeTruthy();
  });
});
