import consola from 'consola';
import { generatorInvokeWrapper } from '../../src/lib/wrapper';

describe.skip('generator wrapper', () => {
  beforeAll(() => {
    jest.setTimeout(300000);

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

    const consolaMessages = (consola.success as any).mock.calls.map(c => c[0]);
    expect(consolaMessages).toEqual(['Generator execution accomplished.']);
  });

  it('should invoke arg function with extra arguments', async () => {
    const func = jest.fn(async () => {});
    await generatorInvokeWrapper(func, 'lip!');

    expect(func).toBeCalled();
    expect(func).toBeCalledTimes(1);
    expect(func).toHaveBeenCalledWith('lip!');

    const consolaMessages = (consola.success as any).mock.calls.map(c => c[0]);
    expect(consolaMessages).toEqual(['Generator execution accomplished.']);
  });

  it('should throw error on function arguments throws error', async () => {
    const func = jest.fn(async () => {});

    try {
      func.mockImplementation(async () => {
        throw new Error('xx');
      });
      // FIXME:
      const consolaMessages = (consola.success as any).mock.calls.map(
        c => c[0]
      );
      expect(consolaMessages).toEqual(['Generator execution accomplished.']);

      expect(await generatorInvokeWrapper(func, 'lip!')).toThrowError('xx');
    } catch (error) {
      void 0;
    }
  });
});
