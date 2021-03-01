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
      if (msg?.type === 'functions') {
        const data = await analysisDecorator(
          options.sourceDir || process.cwd()
        );
        process.send({ type: 'dev:' + msg.type, data, id: msg.id });
      }
    });
  }

  process.send({ type: 'started', startSuccess });
})();
