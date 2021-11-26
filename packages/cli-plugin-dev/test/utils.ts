import { CommandCore, exec } from '@midwayjs/command-core';
import { DevPlugin } from '../src';
export const wait = (time?) => {
  return new Promise(resolve => {
    setTimeout(resolve, time || 20000);
  });
};
export const run = async (cwd: string, options = {}) => {
  await exec({
    baseDir: cwd,
    cmd: 'npm install @midwayjs/mock',
  });
  const core = new CommandCore({
    commands: ['dev'],
    options,
    log: {
      log: console.log,
    },
    cwd,
  });
  core.addPlugin(DevPlugin);
  await core.ready();
  core.invoke(['dev'], false, {
    ts: true,
    ...options,
  });
  await wait();
  return {
    close: core.store.get('global:dev:closeApp'),
    port: core.store.get('global:dev:port'),
    getData: core.store.get('global:dev:getData'),
  };
};
