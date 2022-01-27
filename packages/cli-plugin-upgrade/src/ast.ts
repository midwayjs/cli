import * as ts from 'typescript';
import { existsSync, ensureFileSync, writeFileSync, removeSync } from 'fs-extra';
import * as prettier from 'prettier';
import { createAstValue } from './astUtils';
const factory = ts.factory;
export enum ImportType {
  NAMED = 'named',  // import { join } from 'path';
  NAMESPACED = 'namespaced', // import * as from 'path';
  NORMAL = 'normal', // import debug from debug
}

export interface IDenpendencyModuleInfo {
  moduleName: string;
  name?: string | string[] | { prop: string; alias: string }[];
  isNameSpace?: boolean;
}

export interface IFileAstInfo {
  file: ts.SourceFile;
  fileName: string;
  changed: boolean;
  removed?: boolean;
}

export class ASTOperator {
  // 内部 cache
  private cache: {[key: string]: any} = {};
  // 根据文件路径获取AST，如果不存在则创建空的AST
  getAstByFile(filePath: string | string[]): IFileAstInfo[] {
    const cacheKey = [].concat(filePath).join(';');
    return this.getCache<IFileAstInfo[]>(cacheKey, () => {
      if (Array.isArray(filePath)) {
        const existsFiles = filePath.filter((fileName: string) => {
          return existsSync(fileName);
        });
        const program: ts.Program = ts.createProgram(existsFiles, {
          skipDefaultLibCheck: true,
          skipLibCheck: true,
        });
        const list = existsFiles.map((fileName: string) => {
          const fileAstInfo = this.getCache<IFileAstInfo[]>(fileName, () => {
            return [{ file : program.getSourceFile(fileName), fileName, changed: false}]
          });
          return fileAstInfo[0];
        });
        return list;
      } else {
        let file: ts.SourceFile;
        if (existsSync(filePath)) {
          const program: ts.Program = ts.createProgram([filePath], {
            skipLibCheck: true,
            skipDefaultLibCheck: true,
          });
          file = program.getSourceFile(filePath);
        } else {
          file = ts.createSourceFile(filePath, '', ts.ScriptTarget.ES2018);
        }
        return [{ file, fileName: filePath, changed: false }];
      }
    });
  }

  // 获取缓存的值，如果没有缓存，则调用 noCacheCallback 来生成缓存数据
  private getCache<T>(cacheKey?: string, noCacheCallback?: () => T): T {
    if (!this.cache) {
      this.cache = {};
    }
    if (!this.cache[cacheKey]) {
      this.cache[cacheKey] = noCacheCallback && noCacheCallback();
    }
    return this.cache[cacheKey];
  }

  public setCache(cacheKey: string, value: any) {
    if (!this.cache) {
      this.cache = {};
    }
    this.cache[cacheKey] = value
  }

  public setAstFileChanged(fileName: string) {
    if (!this.cache[fileName]) {
      return;
    }
    this.cache[fileName][0].changed = true;
  }


  // 输出生成的文件
  public done() {
    const result: any = {};
    const printer: ts.Printer = ts.createPrinter({
      newLine: ts.NewLineKind.CarriageReturnLineFeed,
      removeComments: false,
    });
    const astCache = this.cache;
    Object.keys(astCache).forEach((filePath) => {
      if (/;/.test(filePath)) {
        return;
      }
      const fileCacheInfo = astCache[filePath]?.[0];
      if (!fileCacheInfo) {
        return;
      }
      if (fileCacheInfo.removed) {
        if (existsSync(fileCacheInfo.fileName)) {
          removeSync(fileCacheInfo.fileName)
        }
        return;
      }
      // 跳过未修改的文件
      if (!fileCacheInfo.changed) {
        return;
      }
      if (!result.files) {
        result.files = [];
      }
      result.files.push(filePath);
      const sourceFile: ts.SourceFile = fileCacheInfo.file;
      let newCode = printer.printFile(sourceFile);
      newCode = unescape(newCode.replace(/\\u([0-9A-F]{4})/g, '%u$1'));
      const prettierCode = this.prettier(newCode);
      ensureFileSync(filePath);
      writeFileSync(filePath, prettierCode);
    });
    return result;
  }

  // 格式化代码
  private prettier(code) {
    return prettier.format(code, {
      parser: 'typescript',
      singleQuote: true,
    });
  }

  public getImportFromFile(file: ts.SourceFile, moduleName?: string): ts.Statement[] {
    const importConfigurations = file.statements.filter((statement: any, index) => {
      statement._index = index;
      if (statement.kind !== ts.SyntaxKind.ImportDeclaration) {
        return;
      }
      if (moduleName) {
        return statement?.moduleSpecifier?.text === moduleName; 
      }
      return true;
    });
    return importConfigurations;
  }

  public removeImportFromFile(fileAstInfo: IFileAstInfo, moduleInfo: IDenpendencyModuleInfo) {
    const { file } = fileAstInfo;
    const { moduleName, name } = moduleInfo;
    if (!Array.isArray(name)) {
      // TODO: more named type, current only support ImportType.NAMED;
      return;
    }
    const namedList: any = name;
    const importConfiguration = file.statements.find((statement: any) => {
      if (statement.kind !== ts.SyntaxKind.ImportDeclaration) {
        return;
      }
      return statement?.moduleSpecifier?.text === moduleName;
    });
    if (!importConfiguration) {
      return;
    }

    const { importClause } = (importConfiguration as any);
    if (importClause.namedBindings.kind === ts.SyntaxKind.NamedImports) {
      const elements = importClause.namedBindings.elements;
      importClause.namedBindings.elements =  elements.filter(element => {
        const elementOriginName = (element.propertyName?.escapedText || element.name.escapedText).toString();
        return !namedList.find(name => {
          return name === elementOriginName;
        });
      });

      if (!importClause.namedBindings.elements.length) {
        (file as any).statements = file.statements.filter(originStatement => {
          return (originStatement as any)._index !== (importConfiguration as any)._index;
        });
      }
    }
  }

  // 向一个文件内插入import代码
  public addImportToFile(fileAstInfo: IFileAstInfo, moduleInfo: IDenpendencyModuleInfo) {
    const { file, fileName } = fileAstInfo;
    const { moduleName, name, isNameSpace } = moduleInfo;

    let importType;
    let namedList;

    if (name) {
      namedList = name;
      if (Array.isArray(name)) {
        // import { join } from 'path';
        importType = ImportType.NAMED;
      } else {
        // import path from 'path',
        // isNameSpace : import * as path from 'path'
        importType = isNameSpace ? ImportType.NAMESPACED : ImportType.NORMAL;
      }
    } else {
      // import 'mysql2';
    }

    const { SyntaxKind } = ts;
    const importConfiguration = file.statements.find((statement: any) => {
      if (statement.kind !== SyntaxKind.ImportDeclaration) {
        return;
      }
      return statement?.moduleSpecifier?.text === moduleName;
    });
    // 如果整个代码文件中没有引入过对应的模块，那么比较简单，直接插入就可以了
    if (!importConfiguration) {
      this.setAstFileChanged(fileName);
      const importStatemanet = ts.createImportDeclaration(
        undefined,
        undefined,
        this.getImportNamedBindings(importType, namedList),
        createAstValue(moduleName),
      );
      (file.statements as any).unshift(importStatemanet);
      return this;
    }

    const { importClause } = (importConfiguration as any);
    if (importType === ImportType.NAMED) {
      // 如果都是named导入
      if (importClause.namedBindings.kind === SyntaxKind.NamedImports) {
        const elements = importClause.namedBindings.elements;
        // 移除已经存在的 named 导入
        elements.forEach((element) => {
          const name = element.name.escapedText; // 最终的 name
          const index = namedList.findIndex(named => {
            return  named.alias === name || named === name;
          });
          if (index !== -1) {
            namedList.splice(index, 1);
          }
        });
        if (namedList.length) {
          this.setAstFileChanged(fileName);
          namedList.forEach((importName: string | { prop: string; alias: string; }) => {
            if (typeof importName === 'object') {
              elements.push(factory.createImportSpecifier(
                factory.createIdentifier(importName.prop),
                factory.createIdentifier(importName.alias),
              ));
            } else {
              elements.push(factory.createImportSpecifier(
                undefined,
                factory.createIdentifier(importName),
              ));
            }
          });
        }
      }
    }

    // TODO: 否则，需要检测当前已引入的类型是什么

    return this;
  }


  // 获取绑定的引入的模块定义
  private getImportNamedBindings(namedType?, bindName?) {
    if (!bindName) {
      return undefined;
    }
    if (namedType === ImportType.NAMED) {
      // import { xxx, xxx2 } from 形式
      return factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports(
          bindName.map((name: string | { prop: string; alias: string }) => {
            if (typeof name === 'object') {
              // import { xxx as xxx2 } from
              return factory.createImportSpecifier(factory.createIdentifier(name.prop), factory.createIdentifier(name.alias));
            }
            return factory.createImportSpecifier(undefined, factory.createIdentifier(name));
          }),
        ),
      );
    } else if (namedType === ImportType.NAMESPACED) {
      // import * as xxx from 形式
      return factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(factory.createIdentifier(bindName)),
      );
    } else {
      // import xxx from 形式
      return factory.createImportClause(
        false,
        factory.createIdentifier(bindName),
        undefined,
      );
    }
  }


  getDecoratorsFromFile(fileAst: ts.SourceFile) {
    const decorators: {
      classStatement?: ts.ClassDeclaration;
      member?: ts.ClassElement,
      decorator: ts.Decorator
    }[] = [];
    fileAst.statements.forEach((statement: ts.Statement) => {
      if (statement.kind !== ts.SyntaxKind.ClassDeclaration) {
        return;
      }
      if (statement.decorators) {
        decorators.push(...statement.decorators.map(deco => {
          return {
            classStatement: statement as ts.ClassDeclaration,
            decorator: deco,
          }
        }));
      }
      
      const classStatement = statement as ts.ClassDeclaration;
      if (classStatement.members) {
        classStatement.members.forEach(member => {
          if (member.decorators) {
            decorators.push(...member.decorators.map(deco => {
              return {
                member,
                classStatement: classStatement,
                decorator: deco,
              }
            }));
          }
        })
      }
    });
    return decorators;
  }
}