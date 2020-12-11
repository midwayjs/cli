import { CommandCore } from '@midwayjs/command-core';
import { getSpecFile, loadSpec } from '@midwayjs/serverless-spec-builder';
import { NewFaaSInvokePlugin } from '../src';
import { resolve } from 'path';
const getInvoke = async (baseDir) => {
  const specFile = getSpecFile(baseDir);
  const core = new CommandCore({
    config: {
      servicePath: baseDir,
      specFile,
    },
    commands: ['invoke'],
    service:loadSpec(baseDir, specFile),
    provider: '',
    options: {
      functionDir: baseDir
    },
    log: console,
  });
  core.addPlugin(NewFaaSInvokePlugin);
  await core.ready();
  await core.invoke(['invoke']);
}

describe('/test/multi.test.ts', () => {

  it('two at same time', async () => {
    await getInvoke(resolve(__dirname, 'fixtures/baseApp'));
  });
});
