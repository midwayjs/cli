import { createApp, close } from '@midwayjs/mock';
import { analysisDecorator } from './utils';
const options = JSON.parse(process.argv[2]);
let app;
process.on('exit', async () => {
  await close(app);
});
(async () => {
  let startSuccess = false;
  try {
    app = await createApp(process.cwd(), options, options.framework);
    startSuccess = true;
  } catch (e) {
    console.log('');
    process.send({
      type: 'error',
      message: 'start error: ' + (e?.message || ''),
    });
    console.log(e);
  }

  if (!process.env.MIDWAY_DEV_IS_SERVERLESS) {
    process.on('message', async msg => {
      if (!msg || !msg.type) {
        return;
      }
      const type = msg.type;
      let data;
      switch (type) {
        case 'functions':
          data = await analysisDecorator(process.cwd());
          break;
      }
      process.send({ type: 'dev:' + type, data, id: msg.id });
    });
  }

  process.send({ type: 'started', startSuccess });
})();
