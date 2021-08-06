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
