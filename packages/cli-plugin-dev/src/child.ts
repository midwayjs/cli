import { createApp, close } from '@midwayjs/mock';
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
    process.send({ type: 'error', message: 'start error' });
    console.log(e);
  }
  process.send({ type: 'started', startSuccess });
})();
