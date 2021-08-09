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
  expectGenerateValidFile,
} from '../../shared';
import {
  WEB_SOCKET_DEP,
  scriptKey,
  scriptValue,
} from '../../../src/core/external/websocket.handler';

describe.skip('WebSocket handler (setup)', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  it('should install required deps only', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'setup']);

    const pkg = jsonfile.readFileSync(packagePath);

    expect(Object.keys(pkg?.dependencies ?? {})).toEqual(WEB_SOCKET_DEP);
  });

  it('should transform source code', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'ws', 'setup']);

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as ws from "@midwayjs/ws"')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[ws]')
    ).toBeTruthy();
  });

  it('should create correct ws-bootstrap.js file', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'ws', 'setup']);

    expect(
      fs.existsSync(path.resolve(baseDir, 'ws-bootstrap.js'))
    ).toBeTruthy();

    const templateBootStrapFile = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../src/templates/websocket/bootstrap.js.ejs'
      ),
      { encoding: 'utf-8' }
    );
    const generatedBootStrapFile = fs.readFileSync(
      path.resolve(baseDir, 'ws-bootstrap.js'),
      { encoding: 'utf-8' }
    );

    expect(
      prettier
        .format(templateBootStrapFile, {
          parser: 'typescript',
          singleQuote: true,
        })
        .trim()
    ).toEqual(generatedBootStrapFile.trim());
  });

  it('should add related npm scripts', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'ws', 'setup']);

    const pkg = jsonfile.readFileSync(packagePath);

    expect(Object.keys(pkg?.scripts ?? {}).includes(scriptKey)).toBeTruthy();
    expect(
      Object.values(pkg?.scripts ?? {}).includes(scriptValue)
    ).toBeTruthy();
  });

  it('should use specified namespace', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'setup'], undefined, {
      namespace: 'wsMod',
    });

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as wsMod from "@midwayjs/ws"')
    ).toBeTruthy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[wsMod]')
    ).toBeTruthy();
  });

  it('should not actually work in dry run mode', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'setup'], undefined, {
      dry: true,
    });

    expect(fs.existsSync(path.resolve(baseDir, 'ws-bootstrap.js'))).toBeFalsy();

    const pkg = jsonfile.readFileSync(packagePath);

    expect(Object.keys(pkg?.dependencies ?? {})).not.toEqual(WEB_SOCKET_DEP);

    expect(
      Object.keys(pkg?.scripts ?? {}).includes(scriptKey)
    ).not.toBeTruthy();
    expect(
      Object.values(pkg?.scripts ?? {}).includes(scriptValue)
    ).not.toBeTruthy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('import * as ws from "@midwayjs/ws"')
    ).toBeFalsy();

    expect(
      fs
        .readFileSync(configurationPath, {
          encoding: 'utf-8',
        })
        .includes('[ws]')
    ).toBeFalsy();
  });
});

describe.skip('WebSocket handler (controller)', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  const sharedClassIdentifier = 'ws';
  const sharedFileName = 'ws-file';
  const sharedDirName = 'ws-dir';

  it('should use option passed in (--dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dotFile: true,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      'controller',
      `${sharedClassIdentifier}.controller.ts`
    );

    expectGenerateValidFile(generatedControllerPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dotFile: true,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      'controller',
      `${sharedClassIdentifier}.controller.ts`
    );

    expectGenerateValidFile(generatedControllerPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dotFile: true,
      file: sharedFileName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      'controller',
      `${sharedFileName}.controller.ts`
    );
    expectGenerateValidFile(generatedControllerPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dotFile: false,
      file: sharedFileName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      'controller',
      `${sharedFileName}.ts`
    );

    expectGenerateValidFile(generatedControllerPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dir `sharedDirName` --dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dotFile: true,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedClassIdentifier}.controller.ts`
    );

    expectGenerateValidFile(generatedControllerPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dir `sharedDirName` --dotFile --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dotFile: true,
      file: sharedFileName,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.controller.ts`
    );

    expectGenerateValidFile(generatedControllerPath, sharedClassIdentifier);
  });

  it('should use option passed in (--file `sharedFileName` --dir `sharedDirName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dotFile: false,
      file: sharedFileName,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.ts`
    );

    expectGenerateValidFile(generatedControllerPath, sharedClassIdentifier);
  });

  it('should use option passed in (--dir `sharedDirName` --dotFile false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dotFile: false,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedClassIdentifier}.ts`
    );

    expectGenerateValidFile(generatedControllerPath, sharedClassIdentifier);
  });

  it('should not actually work in dry run mode (--dry --dir `sharedDirName` --file `sharedFileName` --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dry: true,
      dir: sharedDirName,
      file: sharedFileName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      sharedDirName,
      `${sharedFileName}.controller.ts`
    );

    expect(fs.existsSync(generatedControllerPath)).not.toBeTruthy();
  });

  it('should not actually work in dry run mode (--dry --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dry: true,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      'controller',
      `${sharedClassIdentifier}.controller.ts`
    );

    expect(fs.existsSync(generatedControllerPath)).not.toBeTruthy();
  });
});
