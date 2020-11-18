import { BaseCLI } from '../src';
import * as assert from 'assert';
import { join } from 'path';
describe('command-core:local-plugin.tets.ts', () => {
  it('local plugin load', async () => {
    const baseDir = join(__dirname, './fixtures/local-plugin');
    const cwd = process.cwd();
    process.chdir(baseDir);
    class TestCli extends BaseCLI {
      async start() {
        await this.loadPlugins();
        await this.core.ready();
      }
      error() {}
    }
    const cli = new TestCli(['', '', 'nocommand']);
    await cli.start();
    process.chdir(cwd);
    assert(cli.core.commands.a);
  });
});
