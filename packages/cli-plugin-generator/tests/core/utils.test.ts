import {
  ensureBooleanType,
  applyTruthyDefaultValue,
  applyFalsyDefaultValue,
  applyDefaultValueToSharedOption,
} from '../../src/core/utils';

describe('core utils', () => {
  it('should ensure boolean value', () => {
    expect(ensureBooleanType(false)).toBeFalsy();
    expect(ensureBooleanType('false')).toBeFalsy();
    expect(ensureBooleanType(true)).toBeTruthy();
    expect(ensureBooleanType('true')).toBeTruthy();
    expect(ensureBooleanType('foo')).toBeTruthy();
  });
  it('should apply truthy default value', () => {
    expect(applyTruthyDefaultValue()).toBeTruthy();
    expect(applyTruthyDefaultValue(true)).toBeTruthy();
    expect(applyTruthyDefaultValue(false)).toBeFalsy();
  });

  it('should apply falsy default value', () => {
    expect(applyFalsyDefaultValue()).toBeFalsy();
    expect(applyFalsyDefaultValue(false)).toBeFalsy();
    expect(applyFalsyDefaultValue(true)).toBeTruthy();
  });

  it('should applt default value tio shared option', () => {
    expect(applyDefaultValueToSharedOption({})).toEqual({
      dry: false,
      dotFile: true,
      override: false,
    });

    expect(
      applyDefaultValueToSharedOption({
        dry: true,
        dotFile: false,
        override: true,
      })
    ).toEqual({
      dry: true,
      dotFile: false,
      override: true,
    });
  });
});
