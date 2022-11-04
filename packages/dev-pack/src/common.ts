import { CommandCore } from '@midwayjs/command-core';
import { DevPlugin } from '@midwayjs/cli-plugin-dev';
import { join } from 'path';
import { IStartOptions } from './interface';
const fetch = require('node-fetch');

export async function startDev(cwd, opts: IStartOptions) {
  const options: any = opts;
  options.notStartLog = true;
  options.ts = true;
  options.slient = options.slient ?? true;
  options.fast = options.fast ?? true;
  if (!options.sourceDir) {
    options.sourceDir = join(cwd, 'src/apis');
  }
  const core = new CommandCore({
    commands: ['dev'],
    options: options,
    log: {
      log: console.log,
    },
    cwd,
  });
  core.addPlugin(DevPlugin);
  if (options.plugins) {
    options.plugins.forEach(plugin => {
      core.addPlugin(plugin);
    });
  }
  await core.ready();
  core.invoke(['dev'], false, options);
  return core;
}

const waitDev = async callback => {
  try {
    const result = await callback();
    if (result) {
      return result;
    }
  } catch {
    //
  }
  return new Promise(resolve => {
    setTimeout(() => {
      waitDev(callback).then(resolve);
    }, 50);
  });
};

export async function invokeByDev(getDevCore) {
  const devCore = await waitDev(() => {
    return getDevCore();
  });
  const port = await waitDev(() => {
    return devCore.store.get('global:dev:port');
  });
  const getData = await waitDev(() => {
    return devCore.store.get('global:dev:getData');
  });
  const functionList = await waitDev(async () => {
    return getData('functions');
  });
  return {
    functionList,
    invoke: async args => {
      const params = args.data[0];
      let query = '';
      if (params.method === 'GET') {
        delete params.body;
      }
      query = Object.keys(params.query || {})
        .map(key => {
          return `${key}=${encodeURIComponent(params.query[key])}`;
        })
        .join('&');
      delete params.query;
      Object.keys(params.headers || {}).forEach(key => {
        // Filter out HTTP/2 pseudo-headers
        if (key[0] === ':') {
          delete params.headers[key];
        }
      });
      params.redirect = 'manual';
      const hostPrefix = `http://127.0.0.1:${port}`;
      const result = await fetch(
        `${hostPrefix}${params.path || '/'}${query ? `?${query}` : ''}`,
        params
      );
      const body = await result.text();
      const statusCode = result.status;
      const headers = result.headers.raw();
      if (statusCode === 302) {
        if (Array.isArray(headers['location'])) {
          headers['location'][0] = headers['location'][0].replace(
            hostPrefix,
            ''
          );
        } else if (typeof headers['location'] === 'string') {
          headers['location'] = headers['location'].replace(hostPrefix, '');
        }
      }
      return {
        headers,
        statusCode,
        body,
      };
    },
  };
}

export async function closeDev(devCore) {
  if (!devCore) {
    return;
  }
  const close = devCore.store.get('global:dev:closeApp');
  if (!close) {
    return;
  }
  return close();
}
