import { Lock } from '../src';
import * as assert from 'assert';
describe('command-core:lock.test.ts', () => {
  it('lock wait', async () => {
    const lock = new Lock('test');

    let isCheck = false;
    const result = [];
    let execTimes = 0;
    await Promise.all(
      [1, 2, 3, 4].map(async num => {
        await lock.wait(async () => {
          await new Promise<void>(resolve => {
            setTimeout(() => {
              isCheck = true;
              execTimes++;
              resolve();
            }, 1000);
          });
        });
        if (isCheck) {
          result.push(num);
        }
      })
    );
    assert(execTimes === 1);
    assert(result.length === 4);
  });
});
