export interface GeneratorSharedOptions {
  /**
   * @description Invoke generator in dry run mode.
   * @value false
   */
  dry: boolean;
  /**
   * @description Use dot file name like `user.service.ts`
   * @value depends on generator type
   */
  dotFile: boolean;
  /**
   * @description Override when file exist
   * @value false
   */
  override: boolean;
  /**
   * @description Customize generated file name
   */
  file: string;
  /**
   * @description Customize generated dir (relative to `PROJECT/src`)
   */
  dir: string;
}

export type Framework = 'koa' | 'express' | 'egg';

export const FrameworkGroup: Framework[] = ['egg', 'express', 'koa'];

export type SLSType = 'faas' | 'aggr';

export const sharedOption: Record<
  keyof GeneratorSharedOptions,
  { usage: string }
> = {
  dry: {
    usage: 'Invoke generator in dry run mode',
  },
  dotFile: {
    usage: 'Use dot file name like `user.service.ts`',
  },
  override: {
    usage: 'Override when file exist',
  },
  file: {
    usage: 'Customize generated file name',
  },
  dir: {
    usage: 'Customize generated dir (relative to `PROJECT/src`)',
  },
};

// true / "true" -> true
// false / "false" -> false
// other("xxxx") -> true
export const ensureBooleanType = (val: string | boolean): boolean => {
  return typeof val === 'boolean' ? val : val !== 'false';
};

export const applyTruthyDefaultValue = (val?: boolean) => {
  return val ?? true;
};

export const applyFalsyDefaultValue = (val?: boolean) => {
  return val ?? false;
};

// TODO: pick by value
export const applyDefaultValueToSharedOption = (
  shared: Partial<GeneratorSharedOptions>
): Record<'dry' | 'dotFile' | 'override', boolean> => {
  return {
    dry: applyFalsyDefaultValue(shared.dry ?? false),
    dotFile: applyTruthyDefaultValue(shared.dotFile ?? true),
    override: applyFalsyDefaultValue(shared.override ?? false),
  };
};
