import { mainProcess } from '../../../src';
import { resolve } from 'path';
export const doing = async () => {
  const processObj = mainProcess({
    file: resolve(__dirname, 'child.js'),
  });
  processObj.onMessage(() => {

  });
  await processObj.waitReady();
  await processObj.send('a', {
    number: 123,
    string: 'str',
    obj: {
      arr: [
        'a', 2, false
      ],
      bool: true
    },
    fun: async () => {
      return 'xxxx';
    }
  });
  const result = await processObj.send('geta');
  processObj.stopChildProcess();
  return result;
}

