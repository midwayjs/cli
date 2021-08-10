import { frameworkSpecificInfo } from './../../../src/core/internal/middleware.handler';
import fs from 'fs-extra';
import path from 'path';
import prettier from 'prettier';
import { resetFixtures, createGeneratorCommand, baseDir } from '../../shared';
import { FrameworkGroup } from '../../../src/core/utils';
import consola from 'consola';
import chalk from 'chalk';

describe('Middleware handler', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
    consola.mockTypes(() => jest.fn());
  });

  const sharedClassIdentifier = 'mw';
  const sharedFileName = 'mw-file';
  const sharedDirName = 'mw-dir';

  it('should create files', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'middleware'], undefined, {
      class: sharedClassIdentifier,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'middleware',
      `${sharedClassIdentifier}.ts`
    );

    expect(fs.existsSync(generatedFilePath)).toBeTruthy();
    expect(
      fs.readFileSync(generatedFilePath, { encoding: 'utf-8' }).length
    ).toBeGreaterThan(0);
  });

  for (const framework of FrameworkGroup) {
    expect(frameworkSpecificInfo(framework).templatePath).toBe(
      `../../templates/middleware/${framework}-middleware.ts.ejs`
    );

    it(`should use correct framework specific info (--framework ${framework})`, async () => {
      const core = await createGeneratorCommand();

      await core.invoke(['gen', 'middleware'], undefined, {
        class: sharedClassIdentifier,
        framework,
      });

      const generatedFilePath = path.resolve(
        baseDir,
        'src',
        'middleware',
        `${sharedClassIdentifier}.ts`
      );

      expect(
        prettier
          .format(fs.readFileSync(generatedFilePath, { encoding: 'utf8' }), {
            parser: 'typescript',
            singleQuote: true,
          })
          .includes(
            framework === 'egg' ? '@midwayjs/web' : `@midwayjs/${framework}`
          )
      ).toBeTruthy();
    });
  }

  it('should use egg template by default', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'middleware'], undefined, {
      class: sharedClassIdentifier,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'middleware',
      `${sharedClassIdentifier}.ts`
    );

    expect(
      prettier
        .format(fs.readFileSync(generatedFilePath, { encoding: 'utf8' }), {
          parser: 'typescript',
          singleQuote: true,
        })
        .includes("import { Context } from 'egg';")
    ).toBeTruthy();
  });

  for (const framework of FrameworkGroup) {
    it(`should use use external with framework: ${framework})`, async () => {
      const core = await createGeneratorCommand();

      await core.invoke(['gen', 'middleware'], undefined, {
        class: sharedClassIdentifier,
        framework,
        external: true,
      });

      const generatedFilePath = path.resolve(
        baseDir,
        'src',
        'middleware',
        `${sharedClassIdentifier}.ts`
      );

      if (framework === 'egg') return;

      expect(
        prettier
          .format(fs.readFileSync(generatedFilePath, { encoding: 'utf8' }), {
            parser: 'typescript',
            singleQuote: true,
          })
          .includes('ThirdPartyLib')
      ).toBeTruthy();
    });
  }

  for (const framework of FrameworkGroup) {
    it(`should use option passed in : ${framework})`, async () => {
      const core = await createGeneratorCommand();

      await core.invoke(['gen', 'middleware'], undefined, {
        class: sharedClassIdentifier,
        framework,
        dir: sharedDirName,
        file: sharedFileName,
      });

      const generatedFilePath = path.resolve(
        baseDir,
        'src',
        sharedDirName,
        `${sharedFileName}.ts`
      );

      expect(fs.existsSync(generatedFilePath)).toBeTruthy();

      expect(
        fs.readFileSync(generatedFilePath, { encoding: 'utf8' }).length
      ).toBeTruthy();
    });
  }

  it('should failed on unsupported framework', async () => {
    const core = await createGeneratorCommand();

    const framework = 'foo';
    const mockExit = jest
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {}) as any);

    await core.invoke(['gen', 'middleware'], undefined, {
      class: sharedClassIdentifier,
      framework,
    });

    expect(mockExit).toHaveBeenCalledWith(0);

    const consolaMessages = (consola.error as any).mock.calls.map(c => c[0]);
    expect(consolaMessages).toEqual([
      `Unsupported framework: ${framework}, use oneof ${chalk.cyan(
        FrameworkGroup.join(' ')
      )}`,
    ]);
  });

  it('should not actually work in dry run mode', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'middleware'], undefined, {
      class: sharedClassIdentifier,
      dry: true,
    });

    const generatedFilePath = path.resolve(
      baseDir,
      'src',
      'middleware',
      `${sharedClassIdentifier}.ts`
    );

    expect(fs.existsSync(generatedFilePath)).not.toBeTruthy();
  });

  it('should not actually work in dry run mode (--file --dir)', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'middleware'], undefined, {
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
