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

describe.skip('Controller handler', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  const sharedClassIdentifier = 'sample';
  const sharedFileName = 'controller-file';
  const sharedDirName = 'controller-dir';

  it('should create files', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'controller'], undefined, {
      class: sharedClassIdentifier,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'controller',
      `${sharedClassIdentifier}.controller.ts`
    );

    expectGenerateValidFile(generatedFilePath, sharedClassIdentifier);
  });

  it('should use full template by default', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'controller'], undefined, {
      class: sharedClassIdentifier,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'controller',
      `${sharedClassIdentifier}.controller.ts`
    );

    expectGenerateValidFile(generatedFilePath, sharedClassIdentifier);

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('HttpCode')
    ).toBeTruthy();
  });

  it('should use light template when --light', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'controller'], undefined, {
      class: sharedClassIdentifier,
      light: true,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'controller',
      `${sharedClassIdentifier}.controller.ts`
    );

    expectGenerateValidFile(generatedFilePath, sharedClassIdentifier);

    expect(
      fs
        .readFileSync(generatedFilePath, { encoding: 'utf8' })
        .includes('HttpCode')
    ).not.toBeTruthy();
  });

  it('should use option passed in (--file --dir)', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'controller'], undefined, {
      class: sharedClassIdentifier,
      file: sharedFileName,
      dir: sharedDirName,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.controller.ts`
    );

    expectGenerateValidFile(generatedFilePath, sharedClassIdentifier);
  });

  it('should use option passed in (--file --dir --dot false)', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'controller'], undefined, {
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

    await core.invoke(['gen', 'controller'], undefined, {
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
