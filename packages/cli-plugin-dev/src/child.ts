import { findNpmModule } from '@midwayjs/command-core';
import { analysisDecorator, waitDebug } from './utils';
const options: any = JSON.parse(process.argv[2]);
let app;
let bootstrapStarter;
const exit = process.exit;

let isCloseApp = false;
let closeFun: any = () => {};
const closeApp = async () => {
  if (isCloseApp) {
    return;
  }
  isCloseApp = true;
  if (bootstrapStarter) {
    await bootstrapStarter.close();
  } else {
    await closeFun(app);
  }
};
(process as any).exit = async () => {
  await closeApp();
  exit();
};
(async () => {
  if (process.env.MIDWAY_DEV_IS_DEBUG) {
    await waitDebug(process.env.MIDWAY_DEV_IS_DEBUG);
  }
  const modPath = findNpmModule(process.cwd(), '@midwayjs/mock');
  if (!modPath) {
    throw new Error('Please add @midwayjs/mock to your devDependencies');
  }
  const { createApp, close, createBootstrap } = require(modPath);
  closeFun = close;
  let startSuccess = false;
  try {
    if (options.entryFile) {
      bootstrapStarter = await createBootstrap(options.entryFile);
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

  if (!process.env.MIDWAY_DEV_IS_SERVERLESS) {
    process.on('message', async (msg: any) => {
      if (!msg) {
        return;
      }
      if (msg.type === 'functions') {
        const data = await analysisDecorator(options.baseDir || process.cwd());
        process.send({ type: 'dev:' + msg.type, data, id: msg.id });
      } else if (msg.type === 'exit') {
        await closeApp();
        process.send({ type: 'dev:' + msg.type, id: msg.id });
        process.exit();
      }
    });
  }

  process.send({ type: 'started', startSuccess });
})();
