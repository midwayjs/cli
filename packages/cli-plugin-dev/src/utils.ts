import { findNpmModule } from '@midwayjs/command-core';
import { platform } from 'os';
import { execSync } from 'child_process';
import { createServer } from 'net';

export const analysisDecorator = async (cwd: string) => {
  const midwayCoreMod = findNpmModule(cwd, '@midwayjs/core');
  const { WebRouterCollector } = require(midwayCoreMod);
  const collector = new WebRouterCollector(cwd, {
    includeFunctionRouter: true,
  });
  const result = await collector.getFlattenRouterTable();
  const allFunc = {};
  if (Array.isArray(result)) {
    result.forEach(func => {
      let method = [].concat(func.requestMethod || 'get');
      if (method.includes('all')) {
        method = [];
      }
      allFunc[func.funcHandlerName] = {
        handler: func.funcHandlerName,
        events: [
          {
            http: {
              method,
              path: (func.prefix + func.url).replace(/\/{1,}/g, '/'),
            },
          },
        ],
      };
    });
  }
  return allFunc;
};

export const checkPort = async (port): Promise<boolean> => {
  return new Promise(resolve => {
    const plat = platform();
    if (plat !== 'win32') {
      try {
        const portUse = execSync(`lsof -i:${port}`)
          .toString()
          .replace(/\n$/, '')
          .split('\n');
        if (portUse.length <= 1) {
          return resolve(false);
        }
        portUse.shift();
        const findUse = portUse.find(proc => {
          const procList = proc.split(/\s+/);
          const last = procList.pop();
          if (last === '(LISTEN)') {
            return true;
          }
        });
        if (findUse) {
          return resolve(true);
        }
      } catch {
        // ignore
      }
    }

    const server = createServer(socket => {
      socket.write('check port\r\n');
      socket.pipe(socket);
    });
    setTimeout(() => {
      server.listen(port, '127.0.0.1');
    }, 100);
    server.on('error', () => {
      resolve(true);
    });
    server.on('listening', () => {
      server.close();
      resolve(false);
    });
  });
};

export async function waitDebug(port) {
  const { ws, chrome } = await getWssUrl(port);
  const send = await debugWs(ws);
  if (chrome) {
    console.log(`\n\nYou can use chrome to debug the midway: ${chrome}\n\n`);
  }
  return send;
}

export function getWssUrl(
  port,
  type?: string,
  count?: number
): Promise<{ ws: string; chrome: string }> {
  return new Promise((resolve, reject) => {
    count = count || 0;
    if (count > 100) {
      return reject('timeout');
    }
    setTimeout(() => {
      const fetch = require('node-fetch');
      fetch('http://127.0.0.1:' + port + '/json/list')
        .then(res => res.json())
        .then(debugInfo => {
          const debugInfoItem = debugInfo[0];
          const ws: string = debugInfoItem['webSocketDebuggerUrl'] || '';
          const chrome: string =
            debugInfoItem['devtoolsFrontendUrlCompat'] ||
            debugInfoItem['devtoolsFrontendUrl'];
          resolve({ ws, chrome });
        })
        .catch(() => {
          getWssUrl(port, type, count + 1)
            .then(resolve)
            .catch(reject);
        });
    }, 100);
  });
}

function debugWs(addr: string) {
  return new Promise(resolve => {
    const WebSocket = require('ws');
    const ws = new WebSocket(addr);
    let currentId = 0;
    const cbMap = {};
    ws.on('open', () => {
      ws.on('message', message => {
        try {
          message = JSON.parse(message);
        } catch (e) {
          // ignore
        }
        if (message.params) {
          const id = message.params.scriptId;
          if (id) {
            if (id > currentId) {
              currentId = id - 0;
            }
            if (cbMap[id]) {
              cbMap[id](message.params);
            }
          }
        }
      });
      const send = (method, params?: any) => {
        return new Promise(resolve2 => {
          const curId = currentId + 1;
          currentId = curId;
          cbMap[curId] = data => {
            resolve2(data);
          };
          const param: any = { id: curId, method };
          if (params) {
            param.params = params;
          }
          ws.send(JSON.stringify(param));
        });
      };
      send('Profiler.enable');
      send('Runtime.enable');
      send('Debugger.enable', { maxScriptsCacheSize: 10000000 });
      send('Debugger.setBlackboxPatterns', { patterns: ['internal'] });
      resolve(send);
    });
  });
}
