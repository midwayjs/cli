import { findNpmModule } from '@midwayjs/command-core';
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
      allFunc[func.funcHandlerName] = {
        handler: func.funcHandlerName,
        events: [
          {
            http: {
              method: [].concat(func.requestMethod || 'get'),
              path: (func.prefix + func.url).replace(/\/{1,}/g, '/'),
            },
          },
        ],
      };
    });
  }
  return allFunc;
};
