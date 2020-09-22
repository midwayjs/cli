import { createApp, close } from '@midwayjs/mock';
import * as chalk from 'chalk';
const options = JSON.parse(process.argv[2]);
let app;
process.on('exit', async () => {
  await close(app);
});
(async () => {
  try {
    app = await createApp(process.cwd(), options, options.framework);
  } catch (e) {
    console.log();
    console.log(chalk.hex('#ff0000')(`[ Midway ] start error: ${e.message}`));
    console.log(e);
  }
  process.send({ type: 'started' });
})();
