import consola from 'consola';

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
