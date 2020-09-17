import { fork } from 'child_process';
const childs: any = new Set();
let hadHook = false;
export const gracefull = proc => {
  // save child ref
  childs.add(proc);

  // only hook once
  /* istanbul ignore else */
  if (!hadHook) {
    hadHook = true;
    let signal;
    ['SIGINT', 'SIGQUIT', 'SIGTERM'].forEach((event: any) => {
      process.once(event, () => {
        signal = event;
        process.exit(0);
      });
    });

    process.once('exit', () => {
      // had test at my-helper.test.js, but coffee can't collect coverage info.
      for (const child of childs) {
        child.kill(signal);
      }
    });
  }
};

export const forkNode = (modulePath, args = [], options: any = {}) => {
  options.stdio = options.stdio || 'inherit';
  const proc: any = fork(modulePath, args, options);
  gracefull(proc);
  return new Promise((resolve, reject) => {
    proc.once('exit', (code: any) => {
      childs.delete(proc);
      if (code !== 0) {
        const err: any = new Error(
          modulePath + ' ' + args + ' exit with code ' + code
        );
        err.code = code;
        reject(err);
      } else {
        resolve();
      }
    });
  });
};
