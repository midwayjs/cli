import {
  SourceFile,
  SyntaxKind,
  VariableDeclarationKind,
  VariableStatement,
  ts,
  TypeNode,
} from 'ts-morph';
import { KeywordTypeSyntaxKind } from 'typescript';
import strip from 'strip-comments';
import consola from 'consola';

// 新增 export const x = {}
export function addConstExport(
  source: SourceFile,
  key: string,
  value: any,
  useStringify = true,
  apply = true
) {
  // 又可以抽离成export相关的方法
  // 拿到所有export const 检查是否已存在
  // 不允许value是函数
  // 添加类型提示的方式
  // const exports

  const exportVars = getExportVariableIdentifiers(source);

  if (exportVars.includes(key)) {
    consola.error(`export ${key} exist!`);
    return;
  }

  source
    .addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: key,
          initializer: writer =>
            writer.write(useStringify ? JSON.stringify(value) : value),
        },
      ],
    })
    .setIsExported(true);

  apply && source.saveSync();
}

export function getExportVariableStatements(
  source: SourceFile,
  varIdentifier: string
): VariableStatement;

export function getExportVariableStatements(
  source: SourceFile
): VariableStatement[];

// 获取所有的导出语句（可根据export的identifier查找）
export function getExportVariableStatements(
  source: SourceFile,
  varIdentifier?: string
): VariableStatement | VariableStatement[] {
  const topLevelVarStatements = source
    .getFirstChildByKind(SyntaxKind.SyntaxList)
    .getChildrenOfKind(SyntaxKind.VariableStatement);

  const exportVarStatements = topLevelVarStatements.filter(v => {
    const syntaxBeforeVarIdentifier = v.getFirstChildIfKind(
      SyntaxKind.SyntaxList
    );

    return (
      syntaxBeforeVarIdentifier &&
      syntaxBeforeVarIdentifier.getText() &&
      syntaxBeforeVarIdentifier.getText() === 'export'
    );
  });

  if (varIdentifier) {
    return exportVarStatements.find(statement => {
      return (
        statement
          .getFirstChildByKind(SyntaxKind.VariableDeclarationList)
          .getFirstChildByKind(SyntaxKind.SyntaxList)
          .getFirstChildByKind(SyntaxKind.VariableDeclaration)
          .getFirstChildByKind(SyntaxKind.Identifier)
          .getText() === varIdentifier
      );
    });
  }

  return exportVarStatements;
}

// 获取所有的导出语句的变量值
export function getExportVariableIdentifiers(source: SourceFile): string[] {
  const exportVarStatements = getExportVariableStatements(source);
  const exportVars = exportVarStatements.map(v =>
    v
      .getFirstChildByKind(SyntaxKind.VariableDeclarationList)
      .getFirstChildByKind(SyntaxKind.SyntaxList)
      .getFirstChildByKind(SyntaxKind.VariableDeclaration)
      // [ 'Identifier', 'EqualsToken', 'ObjectLiteralExpression' ]
      .getFirstChildByKind(SyntaxKind.Identifier)
      .getText()
  );

  return exportVars;
}

export function removeConstExport(
  source: SourceFile,
  identifier?: string,
  apply = true
) {
  const exportVars = getExportVariableIdentifiers(source);

  if (identifier && !exportVars.includes(identifier)) {
    consola.error(`export ${identifier} doesnot exist!`);
    return;
  }

  identifier
    ? getExportVariableStatements(source, identifier).remove()
    : exportVars.forEach(exp =>
        getExportVariableStatements(source, exp).remove()
      );

  apply && source.saveSync();
}

export function updateConstExportIdentifier(
  source: SourceFile,
  currentKey: string,
  updatedKey: string,
  apply = true
) {
  const exportVars = getExportVariableIdentifiers(source);

  if (!exportVars.includes(currentKey)) {
    consola.error(`export ${currentKey} doesnot exist!`);
    return;
  }

  const targetVar = getExportVariableStatements(source, currentKey);

  const targetVarDeclaration = targetVar
    .getFirstChildByKind(SyntaxKind.VariableDeclarationList)
    .getFirstChildByKind(SyntaxKind.SyntaxList)
    .getFirstChildByKind(SyntaxKind.VariableDeclaration);

  const targetVarValueNode = targetVarDeclaration.getLastChild();

  const targetVarValueKind = targetVarValueNode.getKind();
  const targetVarTextValue = targetVarValueNode.getText();

  if (targetVarValueKind === SyntaxKind.NumericLiteral) {
    addConstExport(
      source,
      updatedKey,
      Number(targetVarTextValue),
      undefined,
      false
    );
    targetVar.remove();
  } else if (targetVarValueKind === SyntaxKind.StringLiteral) {
    addConstExport(
      source,
      updatedKey,
      String(targetVarTextValue).replaceAll("'", ''),
      undefined,
      false
    );
    targetVar.remove();
  } else if (
    [SyntaxKind.TrueKeyword, SyntaxKind.FalseKeyword].includes(
      targetVarValueKind
    )
  ) {
    addConstExport(
      source,
      updatedKey,
      targetVarTextValue !== 'false',
      undefined,
      false
    );
    targetVar.remove();
  } else if (targetVarValueKind === SyntaxKind.ArrowFunction) {
    addConstExport(source, updatedKey, targetVarTextValue, false, false);
    targetVar.remove();
  } else if (targetVarValueKind === SyntaxKind.ObjectLiteralExpression) {
    addConstExport(source, updatedKey, targetVarTextValue, false, false);
    targetVar.remove();
  }

  apply && source.saveSync();
}

// 新增类型定义 export const x:xxx = {}
export function addConstExportTypeRef(
  source: SourceFile,
  exportVar: string,
  typeRef = 'unknown',
  infer = true,
  apply = true
) {
  const targetExport = getExportVariableStatements(source, exportVar);

  const varDec = targetExport
    .getFirstChildByKind(SyntaxKind.VariableDeclarationList)
    .getFirstChildByKind(SyntaxKind.SyntaxList)
    .getFirstChildByKind(SyntaxKind.VariableDeclaration);

  if (
    varDec.getChildren().length > 3 &&
    varDec
      .getChildren()
      .map(c => c.getKind())
      .includes(SyntaxKind.ColonToken)
  ) {
    consola.error(`Variable ${exportVar} has type reference yet.`);
    process.exit(0);
  }

  const varValueLiteral = varDec.getLastChild();

  const varValueKind = varValueLiteral.getKind();

  const typeRefToApply = infer
    ? varValueKind === SyntaxKind.StringLiteral
      ? 'string'
      : varValueKind === SyntaxKind.NumericLiteral
      ? 'number'
      : [SyntaxKind.TrueKeyword, SyntaxKind.FalseKeyword].includes(varValueKind)
      ? 'boolean'
      : varValueKind === SyntaxKind.ObjectLiteralExpression
      ? 'Record<string, unknown>'
      : varValueKind === SyntaxKind.ArrowFunction
      ? '(...args: unknown) => unknown'
      : 'unknown'
    : typeRef;

  varDec.setType(typeRefToApply).getText();

  apply && source.saveSync();
}

// 新增类型断言
export function addConstExportTypeAssertion(
  source: SourceFile,
  exportVar: string,
  typeRef = 'unknown',
  apply = true
) {
  const targetExport = getExportVariableStatements(source, exportVar);

  const varDec = targetExport
    .getFirstChildByKind(SyntaxKind.VariableDeclarationList)
    .getFirstChildByKind(SyntaxKind.SyntaxList)
    .getFirstChildByKind(SyntaxKind.VariableDeclaration);

  console.log(varDec.getChildren().map(x => x.getKindName()));

  // {} as any -> AsExpression

  if (
    varDec
      .getChildren()
      .map(c => c.getKind())
      .includes(SyntaxKind.AsExpression)
  ) {
    consola.error(`Variable ${exportVar} has type assertion yet.`);
    process.exit(0);
  }

  // varDec.getLastChild().replaceWithText()

  // console.log(
  //   ts.factory.createAsExpression(
  //     ts.factory.createObjectLiteralExpression([]),
  //     ts.factory.createKeywordTypeNode(SyntaxKind.AnyKeyword)
  //   )
  //   // .getText()
  // );
  // const t1 = varDec.getFirstChildByKind(SyntaxKind.ObjectLiteralExpression)
}
