import { fork } from 'child_process';
import { getChildObj } from './utils';
/*
主进程中使用:
const processObj = mainProcess({
  file: 'child.js',
});
processObj.onMessage(async (type, data) => {

})
await processObj.waitReady();
const result = await processObj.send('invoke', data, true);

子进程中使用:
const processObj = child();
processObj.onMessage(async (type, data) => {

});
processObj.ready();

*/
export const mainProcess = options => {
  const { file, data, cwd } = options;
  const childProcess = fork(file, [JSON.stringify(data || {})], {
    cwd: cwd || process.cwd(),
    env: process.env,
  });
  const processObj = getChildObj(childProcess);
  return processObj;
};

export const childProcess = () => {
  const processObj: any = getChildObj();
  processObj.ready = () => {
    processObj.send('ready');
  };
  return processObj;
};
