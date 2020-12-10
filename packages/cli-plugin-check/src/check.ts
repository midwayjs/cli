import { CompilerHost, Program, resolveTsConfigFile, Analyzer } from '@midwayjs/mwcc';
import { resolve } from 'path';
import * as camelcase from 'camelcase';
export class Check {
  cwd: string;
  sourceDir: string;
  private compilerHost: CompilerHost;
  private program: Program;
  constructor(cwd: string, sourceDir: string) {
      this.cwd = cwd;
      this.sourceDir = sourceDir;
      this.init();
  }

  init() {
    const { config } = resolveTsConfigFile(
      this.cwd,
      undefined,
      undefined,
      undefined,
      {
        compilerOptions: {
          sourceRoot: resolve(this.cwd, this.sourceDir),
        },
      }
    );
    this.compilerHost = new CompilerHost(this.cwd, config);
    this.program = new Program(this.compilerHost);
  }

  getAstResult() {
    const analyzeInstance = new Analyzer({
      program: this.program,
      decoratorLowerCase: true,
    });
    return analyzeInstance.analyze();
  }

  async analysis() {
    const astResult = this.getAstResult();

    const result = [
      ...this.analysisProvideNotExport(astResult),
      ...this.analysisInjectNotProvide(astResult),
    ];
    return result;
  }

  // Error: provide-no-export
  analysisProvideNotExport(astResult) {
    const provide = astResult?.decorator?.provide || [];
    return provide.filter(provideItem => {
      const exportType = provideItem?.target?.nodeInfo?.exportType;
      return !exportType || exportType === 'not';
    }).map(item => {
      const target = item?.target || {};
      const { name, type, fileName, position } = target;
      let message = '';
      if (type !== 'class') {
        message = `Provide 装饰的 '${name}' 不是一个 class`;
      } else {
        message = `Provide 装饰的类 '${name}' 没有导出`;
      }
      return {
        level: 'error',
        message,
        fileName,
        position: position.range,
      }
    });
  }

  // Warn: Inject的内容没有在Provide中
  // provideWrapper的可能找不到
  analysisInjectNotProvide(astResult) {
    // console.log('astResult', JSON.stringify(astResult, null, 2));
    const provide = astResult?.decorator?.provide || [];
    const provideMap = {};
    provide.forEach(item => {
      const name = item.params?.[0] || camelcase(item.target?.name);
      provideMap[name] = true;
    });
    const inject = astResult?.decorator?.inject || [];
    let injectKey;
    return inject.filter(item => {
      // 不处理诸如类的情况
      if (item.params.length) {
        const firstParams = item.params[0];
        if (typeof firstParams !== 'string') {
          return;
        }
        injectKey = firstParams;
      } else {
        injectKey = camelcase(item.target?.name);
      }
      // 默认注入的不处理
      if (['baseDir', 'appDir', 'ctx', 'logger', 'req', 'res', 'socket'].includes(injectKey)) {
        return;
      }
      return true;
    }).map(item => {
      const target = item?.target || {};
      const { name, fileName, position } = target;
      return {
        level: 'warn',
        message: `Inject 的属性 '${name}' 没有在 Provide 中找到`,
        fileName,
        position: position.range,
      }
    });
  }
}