import consola from 'consola';
import {
  GeneratorCoreWrapperArgs,
  InferWrapperOptionParam,
  InferWrapperTypeParam,
  RequiredGeneratorCoreFuncStruct,
} from '../../utils';

/**
 * Experimental wrapper with full type definitions support / inferrence.
 * Currently it was applied only on Controller / ORM(requires a sub-type as extra paramater) handler.
 * Next Stage: Simplify!
 * @param core Generator core handler
 * @param extraArgs Arguments to pass to core
 * @type GeneratorArgs: Should extends `GeneratorCoreWrapperArgs`, represents the parameters that core function will received.
 * @type GeneratorCoreHandler: Should extends `RequiredGeneratorCoreFuncStruct`, represents the structure(args type & return type) that core func should be restricted with.
 * @type GeneratorOptions: Inferred from `GeneratorArgs`, represents the generator specificed options.
 * @type GeneratorType: Inferred from `GeneratorArgs`, represents the generator sub-type(if exists).
 */
export async function generatorInvokeWrapperExp<
  GeneratorArgs extends GeneratorCoreWrapperArgs<
    GeneratorOptions,
    GeneratorType
  >,
  GeneratorCoreHandler extends RequiredGeneratorCoreFuncStruct<
    GeneratorOptions,
    GeneratorType
  >,
  GeneratorOptions = InferWrapperOptionParam<GeneratorArgs>,
  GeneratorType = InferWrapperTypeParam<GeneratorArgs>
>(core: GeneratorCoreHandler, extraArgs: GeneratorArgs) {
  try {
    await core(extraArgs);
    consola.success('Generator execution accomplished.');
  } catch (error) {
    consola.fatal('Generator execution failed. \n');
    throw error;
  }
}

export async function generatorInvokeWrapper(
  core: (...args: unknown[]) => Promise<unknown>,
  ...extraArgs: unknown[]
) {
  try {
    await core(...extraArgs);
    consola.success('Generator execution accomplished.');
  } catch (error) {
    consola.fatal('Generator execution failed. \n');
    throw error;
  }
}

// export async function generatorInvokeWrapper<
//   GeneratorArgs extends GeneratorCoreWrapperArgs<GeneratorOptions>,
//   GeneratorCoreHandler extends RequiredGeneratorCoreFuncStruct<GeneratorOptions>,
//   GeneratorOptions = InferWrapperOptionParam<GeneratorArgs>
// >(core: GeneratorCoreHandler, extraArgs: GeneratorArgs) {
//   try {
//     await core(extraArgs);
//     consola.success('Generator execution accomplished.');
//   } catch (error) {
//     consola.fatal('Generator execution failed. \n');
//     throw error;
//   }
// }
