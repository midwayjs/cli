const options = JSON.parse(process.argv[2]);
console.log('options', options, process.env.MIDWAY_TS_MODE);
const layers = [];
let starter;
let runtime;
const { asyncWrapper } = require(options.starterModule);
const starterMod = require(options.faasModName);
const { start } = require(options.starterModule);

// 加载函数入口
const initialize = async (initializeContext = {}) => {
  
  layers.unshift(engine => {
    engine.addRuntimeExtension({
      async beforeFunctionStart(runtime) {
        if (starterMod.Framework) {
          starter = new starterMod.Framework();
          starter.configure({
            initializeContext,
            applicationAdapter: runtime
          });
          const { BootstrapStarter } = require('@midwayjs/bootstrap');
          const boot = new BootstrapStarter();
          const baseDir = options.functionDir;

          boot.configure({
            baseDir,
          }).load(starter);

          await boot.init();
          await boot.run();
        } else {
          starter = new starterMod[options.faasStarterName]({ baseDir: options.functionDir, initializeContext, applicationAdapter: runtime });
          await starter.start();
        }
      }
    });
  })
  runtime = await start({
    layers: layers,
    initContext: initializeContext,
  });
}

// 执行函数handler
const handler = async (handlerName, args) => {
  const handlerFun = asyncWrapper(async (...args) => {
    console.log('handlerName', handlerName);
    const handler = starter.handleInvokeWrapper(handlerName);
    return runtime.asyncEvent(handler)(...args);
  });
  const result = await handlerFun(...args);
  return {
    handler,
    result
  };
}

(async () => {
  let startSuccess = false;
  try {
    startSuccess = true;
    await initialize();
  } catch (err) {
    console.log(err);
    process.send({
      type: 'error',
      message: 'start error: ' + (err?.message || ''),
      err,
    });
  }
  process.send({ type: 'started', startSuccess });
  if (!startSuccess) {
    return;
  }
  process.on('message', async msg => {
    if (msg.type === 'invoke') {
      try {
        const result = await handler(msg.handler, msg.args || []);
        process.send({ type: 'result', id: msg.id, success: true, data: result });
      } catch (err) {
        console.log(err);
        process.send({ type: 'result', id: msg.id, success: false, err });
      }
    }
  });
})();