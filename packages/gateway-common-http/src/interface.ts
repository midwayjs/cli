export interface DevPackOptions {
  functionDir: string; // 本地目录，默认 process.cwd()
  sourceDir?: string; // 一体化调用时，需要知道当前的函数目录结构
  apiPath?: string | RegExp; // 只有匹配到这个才会执行函数逻辑
  ignorePattern?: string[] | ((req: any) => boolean); // 中后台下，特定的路由会忽略交给 webpackServer 去执行，比如 assets 地址
  ignoreWildcardFunctions?: string[]; // 忽略通配的函数名
  originGatewayName?: string; // 配置在 yml 里的 apiGatway 的 type
  verbose?: boolean; // 展示更多信息
  dev?: any; // 是否启用dev模式
}

export interface InvokeOptions {
  functionDir?: string; // 函数所在目录
  functionName?: string; // 函数名
  functionHandler?: string; // 函数的handler
  data?: any[]; // 函数入参
  trigger?: string; // 触发器
  handler?: string;
  sourceDir?: string; // 一体化目录结构下，函数的目录，比如 src/apis，这个影响到编译
  clean?: boolean; // 清理调试目录
  incremental?: boolean; // 增量编译
  verbose?: boolean | string; // 输出更多信息
  getFunctionList?: boolean; // 获取函数列表
}

export type InvokeCallback = (result: InvokeOptions) => Promise<any>;
