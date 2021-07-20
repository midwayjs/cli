const { BootstrapStarter } = require('@midwayjs/bootstrap');
const { Framework } = require('@midwayjs/faas');
const { asyncWrapper, start } = require('@midwayjs/serverless-scf-starter');
const { match } = require('path-to-regexp');
const layers = [];


let starter;
let runtime;
let inited = false;

const initializeMethod = async (initializeContext = {}) => {
  layers.unshift(engine => {
    engine.addRuntimeExtension({
      async beforeFunctionStart(runtime) {
        starter = new Framework();
        starter.configure({
          initializeContext,
          preloadModules: [],
          applicationAdapter: runtime
        });
        const boot = new BootstrapStarter();
        boot.configure({
          appDir: __dirname,
        }).load(starter);

        await boot.init();
        await boot.run();
      }
    });
  })
  runtime = await start({
    layers: layers,
    initContext: initializeContext,
    runtimeConfig: {"service":{"name":"midway-wechat-test"},"provider":{"name":"wechat","wechatConfig":{"permissions":{"openapi":["wxacode.get"]}}},"package":{"include":["config.json","sitemap.json"]},"functions":{"helloService-handler":{"handler":"helloService.handler","events":[{"event":true}]}},"globalDependencies":{"@midwayjs/serverless-scf-starter":"*"}},
  });

  inited = true;
};

const getHandler = (hanlderName, ...originArgs) => {
  
    if (hanlderName === 'handler') {
      return  starter.handleInvokeWrapper('helloService.handler'); 
    }
  
}

exports.initializer = asyncWrapper(async (...args) => {
  if (!inited) {
    await initializeMethod(...args);
  }
});


exports.handler = asyncWrapper(async (...args) => {
  if (!inited) {
    await initializeMethod();
  }

  const handler = getHandler('handler', ...args);
  return runtime.asyncEvent(handler)(...args);
});

