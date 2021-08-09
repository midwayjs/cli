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
  WEB_SOCKET_DEP,
  scriptKey,
  scriptValue,
} from '../../../src/core/external/websocket.handler';
import { capitalCase } from 'capital-case';

describe.skip('WebSocket handler (setup)', () => {
  beforeAll(() => {
    jest.setTimeout(300000);
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

describe('WebSocket handler (controller)', () => {
  beforeAll(() => {
    jest.setTimeout(300000);
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  const sharedClassIdentifier = 'ws';
  const sharedFileName = 'ws-file';
  const sharedDirName = 'ws-dir';

  it.only('should use option passed in (--dot --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dot: true,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      'controller',
      `${sharedClassIdentifier}.controller.ts`
    );

    expect(fs.existsSync(generatedControllerPath)).toBeTruthy();

    expect(fs.readFileSync(generatedControllerPath).length).toBeGreaterThan(0);

    expect(
      fs
        .readFileSync(generatedControllerPath)
        .includes(capitalCase(sharedClassIdentifier))
    ).toBeTruthy();
  });

  it('should use option passed in (--dot false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dot: true,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      `${sharedClassIdentifier}.ts`
    );

    expect(fs.existsSync(generatedControllerPath)).toBeTruthy();

    expect(fs.readFileSync(generatedControllerPath).length).toBeGreaterThan(0);
  });

  it('should use option passed in (--file `sharedFileName` --dot --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dot: true,
      file: sharedFileName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      `${sharedFileName}.controller.ts`
    );

    expect(fs.existsSync(generatedControllerPath)).toBeTruthy();

    expect(fs.readFileSync(generatedControllerPath).length).toBeGreaterThan(0);
  });

  it('should use option passed in (--file `sharedFileName` --dot false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dot: false,
      file: sharedClassIdentifier,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      'src',
      `${sharedFileName}.ts`
    );

    expect(fs.existsSync(generatedControllerPath)).toBeTruthy();

    expect(fs.readFileSync(generatedControllerPath).length).toBeGreaterThan(0);
  });

  it('should use option passed in (--dir `sharedDirName` --dot --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dot: true,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      sharedDirName,
      `${sharedClassIdentifier}.controller.ts`
    );

    expect(fs.existsSync(generatedControllerPath)).toBeTruthy();

    expect(fs.readFileSync(generatedControllerPath).length).toBeGreaterThan(0);
  });

  it('should use option passed in (--dir `sharedDirName` --dot false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dot: false,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      sharedDirName,
      `${sharedClassIdentifier}.ts`
    );

    expect(fs.existsSync(generatedControllerPath)).toBeTruthy();

    expect(fs.readFileSync(generatedControllerPath).length).toBeGreaterThan(0);
  });

  it('should use option passed in (--file `sharedFileName` --dir `sharedDirName` --dot --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dot: true,
      file: sharedFileName,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      sharedDirName,
      `${sharedFileName}.controller.ts`
    );

    expect(fs.existsSync(generatedControllerPath)).toBeTruthy();

    expect(fs.readFileSync(generatedControllerPath).length).toBeGreaterThan(0);
  });

  it('should use option passed in (--file `sharedFileName` --dir `sharedDirName` --dot false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dot: false,
      file: sharedFileName,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      sharedDirName,
      `${sharedFileName}.ts`
    );

    expect(fs.existsSync(generatedControllerPath)).toBeTruthy();

    expect(fs.readFileSync(generatedControllerPath).length).toBeGreaterThan(0);
  });

  it('should use option passed in (--dir `sharedDirName` --dot false --class `sharedClassIdentifier`)', async () => {
    const core = await createGeneratorCommand();
    await core.invoke(['gen', 'ws', 'controller'], undefined, {
      dot: false,
      file: sharedFileName,
      dir: sharedDirName,
      class: sharedClassIdentifier,
    });

    const generatedControllerPath = path.resolve(
      baseDir,
      sharedDirName,
      `${sharedClassIdentifier}.ts`
    );

    expect(fs.existsSync(generatedControllerPath)).toBeTruthy();

    expect(fs.readFileSync(generatedControllerPath).length).toBeGreaterThan(0);
  });
});
