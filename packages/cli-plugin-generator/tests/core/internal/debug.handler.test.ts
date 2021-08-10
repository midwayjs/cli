import fs from 'fs-extra';
import path from 'path';
import { resetFixtures, createGeneratorCommand, baseDir } from '../../shared';
import { DEBUG_CONFIG_PATH } from '../../../src/core/internal/debug.handler';

const generatedFilePath = path.resolve(baseDir, DEBUG_CONFIG_PATH);
console.log('generatedFilePath: ', generatedFilePath);

const createConfiguration = (name = 'Midway Local', port = 7777) => ({
  name,
  type: 'node',
  request: 'launch',
  cwd: '${workspaceRoot}',
  runtimeExecutable: 'npm',
  windows: {
    runtimeExecutable: 'npm.cmd',
  },
  runtimeArgs: ['run', 'dev'],
  env: {
    NODE_ENV: 'local',
  },
  console: 'integratedTerminal',
  protocol: 'auto',
  restart: true,
  port,
  autoAttachChildProcesses: true,
});

describe('Debug handler', () => {
  beforeAll(async () => {
    jest.setTimeout(300000);
    await resetFixtures();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  it('should create files', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'debug'], undefined, {});

    expect(fs.existsSync(generatedFilePath)).toBeTruthy();

    expect(
      JSON.parse(fs.readFileSync(generatedFilePath, { encoding: 'utf-8' }))
    ).toEqual({
      version: '0.2.0',
      configuration: [createConfiguration()],
    });
  });

  it('should use option passed in (--name Midway --port 8989)', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'debug'], undefined, {
      name: 'Midway',
      port: 8989,
    });

    expect(fs.existsSync(generatedFilePath)).toBeTruthy();

    expect(
      JSON.parse(fs.readFileSync(generatedFilePath, { encoding: 'utf-8' }))
    ).toEqual({
      version: '0.2.0',
      configuration: [createConfiguration('Midway', 8989)],
    });
  });

  it('should not actually work in dry run mode', async () => {
    const core = await createGeneratorCommand();

    await core.invoke(['gen', 'debug'], undefined, {
      dry: true,
    });

    expect(fs.existsSync(generatedFilePath)).not.toBeTruthy();
  });
});
