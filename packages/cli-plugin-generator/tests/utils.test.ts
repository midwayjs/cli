import { ensureBooleanType } from '../src/core/utils';

describe('ensure boolean type', () => {
  it('true / "true" -> true', () => {
    expect(ensureBooleanType(true)).toBeTruthy();
    expect(ensureBooleanType('true')).toBeTruthy();
  });

  it('false / "false" -> false', () => {
    expect(ensureBooleanType(false)).toBeFalsy();
    expect(ensureBooleanType('false')).toBeFalsy();
  });

  it('"any other value" -> true', () => {
    expect(ensureBooleanType('xxxx')).toBeTruthy();
  });
});
