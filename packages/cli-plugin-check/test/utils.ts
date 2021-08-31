import { CommandCore } from '@midwayjs/command-core';
import { CheckPlugin } from '../src';
export const runCheck = async (cwd: string) => {
  const logs = [];
  const core = new CommandCore({
    commands: ['check'],
    log: {
      log: (...args) => {
        logs.push(...args);
      },
    },
    cwd,
  });
  core.addPlugin(CheckPlugin);
  await core.ready();
  await core.invoke();
  return logs;
};
