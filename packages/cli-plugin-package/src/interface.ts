export interface ICopyOptions {
  sourceDir: string;
  targetDir: string;
  defaultInclude?: string[];
  include?: string[];
  exclude?: string[];
  log?: (path: string) => void;
}

export interface IAggregationConfig {
  [aggregationName: string]: {
    deployOrigin?: boolean;
    functions?: string[];
    functionsPattern?: string[];
  };
}

export interface ModInfo {
  name: string;
  version: string;
}

export interface MakeZipOptions {
  npm?: string;
  removeUselessFiles?: boolean;
}
