import { AnalyzeResult } from '@midwayjs/mwcc';

// 首字母小写
const firstCharLower = str => {
  return str.replace(/^[A-Z]/g, match => match.toLowerCase());
};

// 驼峰变为 -
const formatUpperCamel = str => {
  return firstCharLower(str).replace(
    /[A-Z]/g,
    match => `-${match.toLowerCase()}`
  );
};

const getEventKey = (type, event) => {
  if (type === 'http') {
    return `${event.method || ''}:${event.path || ''}`;
  }
  return type;
};

export const analysisResultToSpec = (analysisResult: AnalyzeResult) => {
  const result: IResult = {
    functions: {},
  };

  const provideList = analysisResult?.decorator?.provide || [];
  provideList.forEach(provide => {
    if (!provide?.childDecorators?.func) {
      return;
    }
    provide.childDecorators.func.forEach(item => {
      formatFuncInfo(result, item, provide.target);
    });
  });

  const funcList = analysisResult?.decorator?.func || [];

  funcList.forEach(item => {
    if (item.target.type !== 'class') {
      return;
    }
    formatFuncInfo(result, item);
  });

  return result;
};

const formatFuncInfo = (result, funcInfo, parentTarget?) => {
  const params = funcInfo.params;
  let className = parentTarget?.name || '';
  let funcName = funcInfo.target.name || 'handler';

  if (funcInfo.target.type === 'class') {
    className = funcInfo.target.name;
    funcName = 'handler';
  }
  let handler;
  let trigger: IEvent;
  if (typeof params[0] === 'string') {
    handler = params[0];
    trigger = params[1];
  } else {
    handler = `${formatUpperCamel(className)}.${formatUpperCamel(funcName)}`;
    trigger = params[0];
  }

  const funName = handler.replace(/\.handler$/, '').replace(/\./g, '-');

  const existsFuncData: IFunction = result.functions[funName] || {};
  existsFuncData.handler = handler;
  const events = existsFuncData.events || [];

  if (!trigger) {
    trigger = {
      event: 'http',
    };
  }

  if (trigger.event) {
    const eventType = trigger.event.toLowerCase();
    const event: IEvent = { [eventType]: true };
    if (eventType === 'http') {
      event.http = {
        method: [(trigger.method || 'GET').toUpperCase()],
        path:
          trigger.path ||
          `/${firstCharLower(className)}/${firstCharLower(funcName)}`,
      };
    }
    // 防止有重复的触发器
    const currentEventKey = getEventKey(eventType, event[eventType]);
    const isExists = events.find(event => {
      if (event[eventType]) {
        const key = getEventKey(eventType, event[eventType]);
        return key === currentEventKey;
      }
    });
    if (!isExists) {
      events.push(event);
    }
  }
  existsFuncData.events = events;
  result.functions[funName] = existsFuncData;
};

export type IParam = string | string[];
export interface IResult {
  functions: {
    [functionName: string]: IFunction;
  };
}

export interface IFunction {
  handler: string;
  events: IEvent[];
}

export interface IEvent {
  http?: {
    method: string | string[];
    path: string;
  };
  [othEvent: string]: any;
}
