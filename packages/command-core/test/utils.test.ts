import { commandLineUsage } from '../src/utils/commandLineUsage';
import { forkNode } from '../src/utils/fork';
import { join } from 'path';
import * as assert from 'assert';
describe('/test/utils.test.ts', () => {
  it('commandLineUsage', async () => {
    const result = commandLineUsage({
      optionList: [
        {
          alias: 't',
          name: 'test',
        },
      ],
    });
    assert(/-t, --test/.test(result));
  });
  it('forkNode', async () => {
    const acmd = join(__dirname, 'fixtures/forkNode/success.js');
    const childProcess = await forkNode(acmd);
    assert(childProcess);
  });
  it('forkNode fail', async () => {
    const acmd = join(__dirname, 'fixtures/forkNode/fail.js');
    try {
      await forkNode(acmd);
      assert(false);
    } catch(e) {
      assert(/exit with code 1/.test(e.message));
    }
  });
});
