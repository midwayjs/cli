import { IFileAstInfo } from "./ast";
import { MidwayFramework } from "./constants";
import * as ts from 'typescript';

export interface IProjectInfo {
  cwd: string;
  pkg: {
    file: string;
    data: any;
  },
  framework: MidwayFramework,
  withServerlessYml: boolean;
  serverlessYml: {
    file: string;
    data: IServerlessYmlData;
  }
  frameworkInfo?: {
    version: IVersion;
    info: ImidwayFrameworkInfo;
  };
  hooksInfo?: IVersion,
  intergrationInfo?: IVersion,
  midwayTsSourceRoot: string;
}

export interface IVersion {
  major: string;
  minor: string;
  patch: string;
};


export interface IServerlessYmlData {
  provider?: {
    name?: string;
  }
}

export interface ImidwayFrameworkInfo {
  module: string;
  type: MidwayFramework;
}

export interface IConfigurationInfo {
  astInfo: IFileAstInfo;
  class: ts.ClassDeclaration;
  func: ts.CallExpression;
}