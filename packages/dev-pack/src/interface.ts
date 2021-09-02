import { DevPackOptions } from '@midwayjs/gateway-common-http';
/** More details */
export interface IStartOptions {
  sourceDir?: string;
  plugins?: any[];
  loadFiles?: string;
  slient?: boolean; // default is true
  fast?: boolean; // default is true
  notWatch?: boolean; // default is false
}

export interface IDevPack {
  (options: DevPackOptions): any;
  close(): Promise<any>;
}
