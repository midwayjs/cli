import { createApp, close } from '@midwayjs/mock';
const options = JSON.parse(process.argv[2]);
let app;
process.on('exit', async () => {
  await close(app);
});
(async () => {
  try {
    app = await createApp(process.cwd(), options, options.framework);
  } catch (e) {
    console.log('[Midway] start error');
    console.log(e);
  }
  process.send({ type: 'started' });
})();
