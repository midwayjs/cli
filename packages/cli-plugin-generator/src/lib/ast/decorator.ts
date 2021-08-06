import {
  SourceFile,
  SyntaxKind,
  DecoratorStructure,
  StructureKind,
  MethodDeclaration,
  PropertyDeclaration,
} from 'ts-morph';

// 更新数组类型的装饰器参数
// 暂时只支持@Deco({  })
export function updateDecoratorArrayArgs(
  source: SourceFile,
  decoratorName: string,
  argKey: string,
  identifier: string,
  apply = true
) {
  const decoratorSyntaxList = source
    .getFirstChildByKind(SyntaxKind.SyntaxList)
    .getFirstChildByKind(SyntaxKind.ClassDeclaration)
    .getFirstChildByKind(SyntaxKind.SyntaxList);

  const correspondingDecorator = decoratorSyntaxList
    .getChildren()
    .filter(child => {
      if (child.getKind() !== SyntaxKind.Decorator) {
        return false;
      } else {
        return (
          child
            .getFirstChildByKind(SyntaxKind.CallExpression)
            .getFirstChildByKind(SyntaxKind.Identifier)
            .getText() === decoratorName
        );
      }
    })[0]
    .asKind(SyntaxKind.Decorator);

  const decoratorArg = correspondingDecorator
    .getArguments()[0]
    .asKind(SyntaxKind.ObjectLiteralExpression);

  const currentArgObjectKeys = decoratorArg
    .getFirstChildByKind(SyntaxKind.SyntaxList)
    .getChildrenOfKind(SyntaxKind.PropertyAssignment)
    .map(assign => assign.getFirstChildByKind(SyntaxKind.Identifier).getText());

  if (currentArgObjectKeys.includes(argKey)) {
    // 参数已存在 合并
    // imports: [orm]
    // add args by addChildText
    const propAssignments = decoratorArg
      .getFirstChildByKind(SyntaxKind.SyntaxList)
      .getChildrenOfKind(SyntaxKind.PropertyAssignment)
      .find(
        assign =>
          assign.getChildrenOfKind(SyntaxKind.Identifier)[0].getText() ===
          argKey
      );

    // orm
    const existPropAssignedValue = propAssignments
      .getFirstChildByKindOrThrow(SyntaxKind.ArrayLiteralExpression)
      .getFirstChildByKind(SyntaxKind.SyntaxList);

    existPropAssignedValue.getText()
      ? existPropAssignedValue.addChildText(`, ${identifier}`)
      : existPropAssignedValue.addChildText(identifier);

    // const existPropAssign = decoratorArg
    //   .getProperty(argKey)
    //   .getFirstChildByKind(SyntaxKind.ArrayLiteralExpression)
    //   .getFirstChildByKind(SyntaxKind.SyntaxList);

    // const existPropAssignValue = existPropAssign.getFirstChildByKind(
    //   SyntaxKind.Identifier
    // );

    // const val: string[] = [];

    // if (!existPropAssignValue) {
    //   val.push(identifier);
    // } else {
    //   val.push(String(existPropAssignValue.getText()), `, ${identifier}`);
    // }
  } else {
    // TODO: support insert at start or end
    decoratorArg.insertPropertyAssignment(0, {
      name: argKey,
      initializer: `[${identifier}]`,
    });
  }

  apply && source.saveSync();
}
