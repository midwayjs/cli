import { findNpmModuleByResolve } from '@midwayjs/command-core';
import { analysisDecorator, waitDebug } from './utils';
const options: any = JSON.parse(process.argv[2]);
let app;
const exit = process.exit;

let isCloseApp = false;
let closeFun: any = () => {};
const closeApp = async () => {
  if (isCloseApp) {
    return;
  }
  isCloseApp = true;
  await closeFun(app);
  exit();
};
(process as any).exit = closeApp;
process.on('disconnect', closeApp);
// 空的 SIGINT，可以有效减少父进程退出等待时间
process.on('SIGINT', () => {});
process.on('unhandledRejection', e => {
  console.error('unhandledRejection', e);
});
process.on('uncaughtException', e => {
  console.error('uncaughtException', e);
});
// 当父进程，支持 CTRL + C 的时候，会先触发子进程的 SIGINT
// 所以要先忽略

(async () => {
  if (process.env.MIDWAY_DEV_IS_DEBUG) {
    await waitDebug(process.env.MIDWAY_DEV_IS_DEBUG);
  }
  const modPath = findNpmModuleByResolve(process.cwd(), '@midwayjs/mock');
  if (!modPath) {
    throw new Error('Please add @midwayjs/mock to your devDependencies');
  }
  const {
    createApp,
    close,
    createFunctionApp,
    createBootstrap,
  } = require(modPath);
  closeFun = close;
  let startSuccess = false;
  try {
    if (options.entryFile) {
      app = await createBootstrap(options.entryFile, options);
    } else if (process.env.MIDWAY_DEV_IS_SERVERLESS === 'true') {
      app = await createFunctionApp(process.cwd(), options);
    } else {
      app = await createApp(process.cwd(), options, options.framework);
    }
    startSuccess = true;
  } catch (e) {
    console.log('');
    process.send({
      type: 'error',
      message: 'start error: ' + ((e && e.message) || ''),
    });
    console.log(e);
  }

  process.on('message', async (msg: any) => {
    if (!msg || !msg.type) {
      return;
    }
    if (msg.type === 'functions') {
      // 因为 在 serverless-app 中，处理的 functions 信息
      if (!process.env.MIDWAY_DEV_IS_SERVERLESS_APP) {
        const data = await analysisDecorator(options.baseDir || process.cwd());
        process.send({ type: 'dev:' + msg.type, data, id: msg.id });
      }
    } else if (msg.type === 'exit') {
      await closeApp();
      process.send({ type: 'dev:' + msg.type, id: msg.id });
      process.exit();
    }
  });

  process.send({
    type: 'started',
    startSuccess,
    port: process.env.MIDWAY_HTTP_PORT,
  });
})();
