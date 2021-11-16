if (typeof window === 'function') {
  const fassEnv = (<any>window).g_config && (<any>window).g_config.faasEnv;
  if (fassEnv !== 'local') {
    // @ts-ignore
    __webpack_public_path__ = (<any>window).resourceBaseUrl;
  }
}

import { createApp, IAppConfig } from 'ice';

const appConfig: IAppConfig = {
  app: {
    rootId: 'ice-container',
  },
  router: {
    type: 'browser',
  },
};

createApp(appConfig);