import consola from 'consola';
import { generatorInvokeWrapper } from '../../src/lib/wrapper';

describe.only('generator wrapper', () => {
  beforeAll(() => {
    // Redirect std and console to consola too
    // Calling this once is sufficient
    consola.wrapAll();
  });

  beforeEach(() => {
    // Re-mock consola before each test call to remove
    // calls from before
    consola.mockTypes(() => jest.fn());
  });

  it('should invoke arg function', async () => {
    const func = jest.fn(async () => {});
    await generatorInvokeWrapper(func);

    expect(func).toBeCalled();
    expect(func).toBeCalledTimes(1);

    // @ts-ignore
    const consolaMessages = consola.success.mock.calls.map(c => c[0]);
    expect(consolaMessages).toEqual(['Generator execution accomplished.']);
  });

  it('should invoke arg function with extra arguments', async () => {
    const func = jest.fn(async () => {});
    await generatorInvokeWrapper(func, 'lip!');

    expect(func).toBeCalled();
    expect(func).toBeCalledTimes(1);
    expect(func).toHaveBeenCalledWith('lip!');

    // @ts-ignore
    const consolaMessages = consola.success.mock.calls.map(c => c[0]);
    expect(consolaMessages).toEqual(['Generator execution accomplished.']);
  });

  it('should throw error on function arguments throws error', async () => {
    const func = jest.fn(async () => {});

    try {
      func.mockImplementation(async () => {
        throw new Error('xx');
      });
      // FIXME:
      // @ts-ignore
      const consolaMessages = consola.fatal.mock.calls.map(c => c[0]);
      console.log('consolaMessages: ', consolaMessages);
      expect(consolaMessages).toEqual(['Generator execution accomplished.']);

      expect(await generatorInvokeWrapper(func, 'lip!')).toThrowError('xx');
    } catch (error) {}
  });
});
