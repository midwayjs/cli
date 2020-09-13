import { commandLineUsage } from '../src/utils/commandLineUsage';
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
});
