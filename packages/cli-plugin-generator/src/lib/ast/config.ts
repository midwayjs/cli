import {
  SourceFile,
  SyntaxKind,
  VariableDeclarationKind,
  VariableStatement,
} from 'ts-morph';
import strip from 'strip-comments';
import consola from 'consola';

// config.x = {}
// 仅适用于默认导出方法形式
export function addConfigKey(
  source: SourceFile,
  key: string,
  value: any,
  apply = true
) {
  const arrowFunc = source
    .getFirstChildByKind(SyntaxKind.SyntaxList)
    .getFirstChildByKind(SyntaxKind.ExportAssignment)
    .getFirstChildByKind(SyntaxKind.ArrowFunction);

  const returnStatement = arrowFunc
    .getFirstChildByKind(SyntaxKind.Block)
    .getFirstChildByKind(SyntaxKind.ReturnStatement);

  const stripedReturnStatement = strip(returnStatement.getText());

  const configVarIdentifier = arrowFunc
    .getBody()
    // const config = {} as DefaultConfig;
    .getFirstChildByKind(SyntaxKind.VariableStatement)
    .getFirstChildByKind(SyntaxKind.VariableDeclarationList)
    .getFirstChildByKind(SyntaxKind.SyntaxList)
    //  [ 'Identifier', 'EqualsToken', 'AsExpression' ]
    .getFirstChildByKind(SyntaxKind.VariableDeclaration)
    .getFirstChildByKind(SyntaxKind.Identifier)
    .getText();

  const existPropAssignmentKeys = arrowFunc
    .getBody()
    .getFirstChildByKind(SyntaxKind.SyntaxList)
    .getChildrenOfKind(SyntaxKind.ExpressionStatement)
    .map(child => {
      const propsAssignTokens = child
        // a.b = x
        .getFirstChildByKind(SyntaxKind.BinaryExpression)
        // a.b
        .getFirstChildByKind(SyntaxKind.PropertyAccessExpression);
      return propsAssignTokens;
    })
    .map(prop => {
      // [ 'Identifier', 'DotToken', 'Identifier' ]
      const children = prop.getChildren();
      if (
        children.length === 3 &&
        children[1].getKind() === SyntaxKind.DotToken
      ) {
        return children[2].getText();
      }
    });

  if (existPropAssignmentKeys.includes(key)) {
    console.error(`${configVarIdentifier}.${key} exist !`);
    process.exit(0);
  }

  returnStatement.remove();

  // FIXME:
  arrowFunc.addStatements(
    `${configVarIdentifier}.${key} = ${JSON.stringify(value)}`
  );

  arrowFunc.addStatements(stripedReturnStatement);

  apply && source.saveSync();

  // const absWritePath = source.getFilePath();

  // const formatted = prettier.format(
  //   fs.readFileSync(absWritePath, { encoding: 'utf8' }),
  //   {
  //     parser: 'typescript',
  //   }
  // );

  // fs.writeFileSync(absWritePath, formatted);
}

export function updateArrayTypeConfig() {}

export function updateObjectTypeConfig() {}

export function updatePrimitiveTypeConfig() {}
