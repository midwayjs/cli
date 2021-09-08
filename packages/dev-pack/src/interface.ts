import { DevPackOptions } from '@midwayjs/gateway-common-http';
/** More details */
export interface IStartOptions {
  sourceDir?: string;
  plugins?: any[];
  slient?: boolean; // default is true
  fast?: boolean | string; // default is true
  notWatch?: boolean; // default is false
}

export interface IDevPack {
  (options: DevPackOptions): any;
  close(): Promise<any>;
}
