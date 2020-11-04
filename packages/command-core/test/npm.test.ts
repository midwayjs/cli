import { CommandCore } from '../src';
import { join } from 'path';
import { existsSync, remove } from 'fs-extra';
import * as assert from 'assert';
describe('command-core:npm.test.ts', () => {
  it('npm plugin', async () => {
    const nm = join(
      __dirname,
      '../node_modules/',
      '@midwayjs/cli-plugin-clean'
    );
    if (existsSync(nm)) {
      await remove(nm);
    }
    const result = [];
    const core = new CommandCore({
      commands: [],
      options: { h: true },
      provider: 'test',
      log: {
        log: (msg: string) => {
          result.push(msg);
        },
      },
      displayUsage: (commandsArray, usage, coreInstance) => {
        result.push(coreInstance.commands);
      },
    });
    core.addPlugin('npm::@midwayjs/cli-plugin-clean');
    await core.ready();
    await core.invoke();
    assert(result.find(cmd => !!cmd.clean));
  });
});
