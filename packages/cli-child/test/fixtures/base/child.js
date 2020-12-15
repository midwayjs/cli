const { childProcess } = require('../../../dist');
const processObj = childProcess();
let globalData;
processObj.onMessage(async (type, data) => {
  if (type === 'a') {
    globalData = data;
  } else {
    const funResult = await globalData.fun();
    globalData.funResult = funResult;
    return globalData;
  }
});
processObj.ready();