import { writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
const functionMap = {};
export const sendData = async (
  childObj,
  type: string,
  data?: any,
  needResponse = true,
  id?: string
) => {
  const { process: proc, resultMap } = childObj;
  id = id || getRandomId();
  data = checkDataIsFunction(childObj, data || {});
  const tmpData = join(tmpdir(), 'data' + id);
  writeFileSync(tmpData, JSON.stringify(data));
  let result;
  if (needResponse) {
    result = new Promise((resolve, reject) => {
      resultMap[id] = { resolve, reject };
    });
  }
  proc.send({ msgType: 'bigData', type, id, needResponse });
  return result;
};

export const getChildObj = (childProcess?) => {
  const isInChildProcess = childProcess ? false : true;
  const obj = {
    isReady: isInChildProcess,
    isInChildProcess,
    resultMap: {},
    process: childProcess || process,
    waitReady: null,
    send: null,
    onMessage: null,
    stopChildProcess: null,
    storeId: getRandomId(),
  };
  obj.waitReady = () => {
    if (obj.isReady) {
      return Promise.resolve(true);
    }
    return new Promise(resolve => {
      setTimeout(() => {
        obj.waitReady().then(resolve);
      }, 50);
    });
  };
  obj.send = async (type: string, data?: any, needResponse?: boolean) => {
    return sendData(obj, type, data, needResponse);
  };
  obj.onMessage = messageListener => {
    onMessage(obj, messageListener);
  };
  obj.stopChildProcess = (signal = 0) => {
    try {
      obj.process.kill(signal);
    } catch {
      //
    }
    try {
      const pid = obj.process.pid;
      execSync('kill -9 ' + pid);
    } catch {
      //
    }
  };
  return obj;
};

// 处理消息
export const onMessage = (childObj, cb: any) => {
  const { process: proc, resultMap } = childObj;
  proc.on('message', async msg => {
    if (!msg) {
      return;
    }
    let innerFun;
    let args = [];
    if (msg.msgType === 'bigData') {
      msg.data = getData(msg.id);
    }
    msg.data = checkDataIsFunction(childObj, msg.data);
    // 处理其他进程响应
    if (msg.type === 'response') {
      const full = resultMap[msg.id];
      if (full) {
        delete resultMap[msg.id];
        const { data } = msg;
        if (data.success !== false) {
          full.resolve(data.result);
        } else {
          full.reject(data.error);
        }
      }
      return;
    } else if (msg.type === 'ready') {
      childObj.isReady = true;
      return;
    } else if (msg.type === 'invokeFunc') {
      const { storeId, funcId } = msg.data;
      args = msg.data.args;
      innerFun = functionMap[storeId][funcId];
    } else {
      innerFun = cb;
      args = [msg.type, msg.data];
    }
    if (!innerFun) {
      return;
    }

    try {
      const cbPromise = innerFun(...args);
      if (!msg.needResponse) {
        return;
      }
      const result = await cbPromise;
      sendData(
        childObj,
        'response',
        {
          success: true,
          result,
        },
        false,
        msg.id
      );
    } catch (e) {
      sendData(
        childObj,
        'response',
        {
          success: false,
          error: {
            message: e.message,
            stack: e.stack,
          },
        },
        false,
        msg.id
      );
    }
  });
};

// 进程间获取大数据
export const getData = (id: number | string): any => {
  const tmpData = join(tmpdir(), 'data' + id);
  return JSON.parse(readFileSync(tmpData).toString());
};

// 获取随机Id
export const getRandomId = (key?: string) => {
  return Date.now() + Math.random() + (key || '');
};

export const getType = (data: unknown): string => {
  return {}.toString.call(data).slice(8, -1).toLowerCase();
};

const childFunPrefix = 'childFunStoreId';
const storeFunction = (storeId, func, inChild) => {
  const allStore = Object.keys(functionMap).sort();
  if (allStore.length > 50) {
    const removeStoreId = allStore.find(id => id !== storeId);
    delete functionMap[removeStoreId];
  }
  const currentStore = functionMap[storeId] || {};
  const functionId = getRandomId(inChild ? 'child' : 'main');
  currentStore[functionId] = func;
  functionMap[storeId] = currentStore;
  return `${childFunPrefix}:${storeId}:${functionId}`;
};

const checkDataIsFunction = (targetProcess, data) => {
  const type = getType(data);
  const { storeId } = targetProcess;
  let newData;
  if (type === 'object') {
    newData = {};
  } else if (type === 'array') {
    newData = new Array(data.length);
  }
  switch (type) {
    case 'object':
      Object.keys(data).forEach(key => {
        newData[key] = checkDataIsFunction(targetProcess, data[key]);
      });
      return newData;
    case 'array':
      data.forEach((item, index) => {
        newData[index] = checkDataIsFunction(targetProcess, item);
      });
      return newData;
    case 'asyncfunction':
      if (data.funcId) {
        // 用来处理a 进程 传递给 b进程，又被b进程传递回来a的问题
        return data.funcId;
      }
      return storeFunction(storeId, data, targetProcess.isInChildProcess);
    case 'string':
      if (data.startsWith(childFunPrefix)) {
        const funcIdList = data.split(':');
        // 用来处理a 进程 传递给 b进程，又被b进程传递回来a的问题
        const storeFun = functionMap[funcIdList[1]]?.[funcIdList[2]];
        if (storeFun) {
          return storeFun;
        }
        const func = async (...args) => {
          return sendData(targetProcess, 'invokeFunc', {
            args,
            storeId: funcIdList[1],
            funcId: funcIdList[2],
          });
        };
        (func as any).funcId = data;
        return func;
      }
      break;
  }
  return data;
};
