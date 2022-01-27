import * as ts from 'typescript';
const factory = ts.factory;
// 创建AST的值，用于替换原有AST结构中的值
export const createAstValue = (value) => {
  let type;
  if (Array.isArray(value)) {
    type = 'array';
  } else {
    type = ([]).toString.call(value).slice(8, -1).toLowerCase();
  }
  switch (type) {
    case 'number':
      return ts.createNumericLiteral(value + '');
    case 'string':
      return ts.createStringLiteral(value);
    case 'boolean':
      return value ? ts.createTrue() : ts.createFalse();
    case 'array':
      return ts.createArrayLiteral(
        value.map((item: any) => {
          return createAstValue(item);
        }),
        false,
      );
    case 'object':
      return ts.createObjectLiteral(
        Object.keys(value).map((key: string) => {
          return ts.createPropertyAssignment(
            ts.createIdentifier(key),
            createAstValue(value[key]),
          );
        }),
        true,
      );
    case 'regexp':
      return ts.createRegularExpressionLiteral(value.toString());
  }
  throw new Error(`Type ${type} not support`);
};

export const expressionToValue = (expression) => {
  switch(expression.kind) {
    case ts.SyntaxKind.Identifier:
      const text = expression.escapedText;
      if (text === 'undefined') {
        return undefined;
      }
      return text
    case ts.SyntaxKind.StringLiteral:
      return expression.text;
    case ts.SyntaxKind.FalseKeyword:
      return false;
    case ts.SyntaxKind.TrueKeyword:
      return true;
    case ts.SyntaxKind.NullKeyword:
      return null;
    case ts.SyntaxKind.NumericLiteral:
      return +expression.text;
    case ts.SyntaxKind.ObjectLiteralExpression:
      const obj = {};
      if (expression.properties) {
        expression.properties.forEach((property: ts.PropertyAssignment) => {
          const name = expressionToValue(property.name);
          const value = expressionToValue(property.initializer);
          obj[name] = value;
        });
      }
      return obj;
    case ts.SyntaxKind.ArrayLiteralExpression:
      let arr = [];
      if (expression.elements?.length) {
        arr = expression.elements.map(element => {
          return expressionToValue(element);
        });
      }
      return arr;
    // Regexp
    case ts.SyntaxKind.RegularExpressionLiteral:
      const regText = expression.text || '';
      const regMatch = /^\/(.*?)\/([a-z]*)$/.exec(regText);
      return new RegExp(regMatch[1], regMatch[2]);
  }
  return {};
}

// 获取一个文件导出的变量的值
// export = 后如果有export xxx，则会忽略export =
// 如果有 export default，则会使用export default，忽略其他所有
export const getFileExportVariable = (file: ts.SourceFile) => {
  const variableList = {};
  // 获取AST分析结果
  const { SyntaxKind } = ts;
  let exportAssignValue = {};
  for (const statement of file.statements) {
    // export =
    if (statement.kind === SyntaxKind.ExportAssignment) {
      const expression = (statement as any)?.expression;
      exportAssignValue = formatNodeValue(expressionToValue(expression));
      // export default
      if (!(statement as any).isExportEquals) {
        return exportAssignValue;
      }
    }
    // 如果不是变量定义，不处理
    if (statement.kind !== SyntaxKind.VariableStatement) {
      continue;
    }
    const isExport = statement.modifiers?.find((modifier: ts.Modifier) => {
      return modifier.kind === SyntaxKind.ExportKeyword;
    });
    // 如果没有导出，则不处理
    if (!isExport) {
      continue;
    }
    const declarations = (statement as any)?.declarationList?.declarations;
    // 如果不存在变量定义，则跳过
    if (!declarations?.length) {
      continue;
    }
    for (const declaration of declarations) {
      // 变量名
      const name = declaration.name.escapedText;
      variableList[name] = formatNodeValue(expressionToValue(declaration.initializer));
    }
  }

  if (Object.keys(variableList).length) {
    return variableList;
  }

  // export =
  return exportAssignValue;
};


export const formatNodeValue = (value) => {
  return value?._getValue ? value._getValue() : value;
};

// 转换代码到代码块AST，这里直接用 createSourceFile 会方便一些
export const codeToBlock = (code: string) => {
  const file = ts.createSourceFile('tmp.ts', code, ts.ScriptTarget.ES2018);
  return file.statements;
};

export enum AST_VALUE_TYPE {
  Identifier = 'identifier',
  String = 'string',
  Func = 'function',
  AST = 'ast',
}

export const statementToCode = (expression: ts.Expression) => {
  const file = ts.createSourceFile('tmp.ts', '', ts.ScriptTarget.ES2018);
  (file as any).statements = [expression];
  const printer: ts.Printer = ts.createPrinter({
    newLine: ts.NewLineKind.CarriageReturnLineFeed,
    removeComments: true,
  });
  const code = printer.printFile(file)
  return code;
}

export interface IValueDefine {
  type: AST_VALUE_TYPE;
  value: any;
  arguments?: IValueDefine[];
}
export const valueToAst = (value: IValueDefine) => {
  if (value.type === AST_VALUE_TYPE.Identifier) {
    return factory.createIdentifier(value.value);
  }
  if (value.type === AST_VALUE_TYPE.Func) {
    return factory.createCallExpression(
      factory.createIdentifier(value.value),
      undefined,
      value.arguments ? value.arguments.map(value => {
        return valueToAst(value);
      }) : []
    );
  }
  if (value.type === AST_VALUE_TYPE.AST) {
    return value.value;
  }
  return createAstValue(value.value)
}

export const astToValue = (element: any): IValueDefine => {
  if (element.kind === ts.SyntaxKind.Identifier) {
    return {
      type: AST_VALUE_TYPE.Identifier,
      value: element.escapedText,
    }
  } else if (element.kind === ts.SyntaxKind.CallExpression) {
    return {
      type: AST_VALUE_TYPE.Func,
      value: element.expression.escapedText,
      arguments: element.arguments.map(element => {
        return astToValue(element);
      })
    }
  }
  return {
    type: AST_VALUE_TYPE.String,
    value: element.text
  }
}