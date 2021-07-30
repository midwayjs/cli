import { CommandCore } from '@midwayjs/command-core';
import { CheckPlugin } from '../src';
export const runCheck = async (cwd: string) => {
  const core = new CommandCore({
    commands: ['check'],
    log: {
      log: console.log,
    },
    cwd,
  });
  core.addPlugin(CheckPlugin);
  await core.ready();
  await core.invoke();
};
