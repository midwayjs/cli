import { ICoreInstance } from '@midwayjs/command-core';

export enum AvailableInternalGenerator {
  Controller = 'Controller',
  Debug = 'Debug',
  Service = 'Service',
  Middleware = 'Middleware',
  Serverless = 'Serverless',
}

export enum AvailableExternalGenerator {
  Axios = 'Axios',
  Cache = 'Cache',
  ORM = 'ORM',
  OSS = 'OSS',
  Prisma = 'Prisma',
  Swagger = 'Swagger',
  WebSocket = 'WebSocket',
}

export type GeneratorCoreWrapperArgs<
  GeneratorOptions = Record<string, unknown>,
  ExtraTypeArgs = void
> = ExtraTypeArgs extends void
  ? {
      core: ICoreInstance;
      options: GeneratorOptions;
    }
  : {
      core: ICoreInstance;
      options: GeneratorOptions;
      type: ExtraTypeArgs;
    };

export type InferFuncUniqueArgType<
  GeneratorOptions,
  GeneratorSubType,
  T extends <
    A extends GeneratorCoreWrapperArgs<GeneratorOptions, GeneratorSubType>
  >(
    args: A
  ) => Promise<void>
> = T extends (args: infer R) => Promise<void> ? R : never;

export type RequiredGeneratorCoreFuncStruct<
  GeneratorOption,
  GeneratorSubType = void
> = <A extends GeneratorCoreWrapperArgs<GeneratorOption, GeneratorSubType>>(
  args: A
) => Promise<void>;

export type InferCoreFuncArgGenericType<T> = T extends (
  args: GeneratorCoreWrapperArgs<infer R>
) => Promise<void>
  ? R
  : never;

export type InferWrapperOptionParam<T> = T extends GeneratorCoreWrapperArgs<
  infer R
>
  ? R
  : void;

export type InferWrapperTypeParam<T> = T extends GeneratorCoreWrapperArgs<
  unknown,
  infer R
>
  ? R
  : void;
