const { createRuntime } = require('@midwayjs/runtime-mock');
const { entryInfo } = JSON.parse(process.argv[2]);
let handler;
let initHandler;
let runtime;
console.log('entryInfo', entryInfo);
if (entryInfo) {
  try {
    const handlerMod = require(entryInfo.fileName);
    handler = handlerMod[entryInfo.handlerName];
    initHandler = handlerMod.initializer;
  } catch (e) {
    console.log(e);
    e.message = `Get Invoke Handler Error: ${e.message}`;
    throw e;
  }
}
if (handler) {
  const runtimeOpts = {
    handler,
  };
  if (initHandler) {
    runtimeOpts.initHandler = initHandler;
  }
  runtime = createRuntime(runtimeOpts);
}

process.on('message', async msg => {
  console.log('msg', msg);
  if (msg.type === 'invoke') {
    const trigger = msg.data;
    try {
      await runtime.start();
      const result = await runtime.invoke(...trigger);
      await runtime.close();
      process.send({
        success: true,
        type: 'response',
        id: msg.id,
        result,
      });
    } catch (e) {
      process.send({
        success: false,
        type: 'response',
        id: msg.id,
        error: {
          message: e.message,
          stack: e.stack,
        },
      });
    }
  }
});
process.send({
  type: 'ready',
});
