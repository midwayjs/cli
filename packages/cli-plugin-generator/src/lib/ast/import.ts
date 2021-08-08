import { ImportDeclaration, SourceFile, SyntaxKind } from 'ts-morph';

import consola from 'consola';

export enum ImportType {
  NAMESPACE_IMPORT = 'NAMESPACE_IMPORT',
  NAMED_IMPORTS = 'NAMED_IMPORTS',
  DEFAULT_IMPORT = 'DEFAULT_IMPORT',
}

export function addImportDeclaration(
  source: SourceFile,
  namespace: string,
  moduleSpecifier: string,
  importType: ImportType.NAMESPACE_IMPORT,
  apply?: boolean
): void;

export function addImportDeclaration(
  source: SourceFile,
  imports: string[],
  moduleSpecifier: string,
  importType: ImportType.NAMED_IMPORTS,
  apply?: boolean
): void;

export function addImportDeclaration(
  source: SourceFile,
  defaultImport: string,
  moduleSpecifier: string,
  importType: ImportType.DEFAULT_IMPORT,
  apply?: boolean
): void;

// 新增一条导入语句
// 如果要新增具名导入成员，使用addNamedImportsMember
// 推荐在新增前使用findImportsSpecifier检查导入是否已存在
export function addImportDeclaration(
  source: SourceFile,
  imports: string | string[],
  moduleSpecifier: string,
  importType: ImportType,
  apply?: boolean
) {
  switch (importType) {
    case ImportType.DEFAULT_IMPORT:
      source.addImportDeclaration({
        defaultImport: imports as string,
        moduleSpecifier,
      });

      break;

    case ImportType.NAMED_IMPORTS:
      source.addImportDeclaration({
        namedImports: imports as string[],
        moduleSpecifier,
      });

      break;

    case ImportType.NAMESPACE_IMPORT:
      source.addImportDeclaration({
        namespaceImport: imports as string,
        moduleSpecifier: moduleSpecifier,
      });

      break;

    default:
      consola.error(`Invalid Import Type ${importType}`);
      process.exit(0);
  }

  const shouldApplySave = apply ?? true;

  shouldApplySave ? source.saveSync() : void 0;
}

export function appendStatementAfterImports(
  source: SourceFile,
  statement: string,
  apply = true
) {
  const imports = source

    .getFirstChildByKind(SyntaxKind.SyntaxList)
    .getChildrenOfKind(SyntaxKind.ImportDeclaration);

  let appendIdx: number;

  if (!imports.length) {
    appendIdx = 0;
  } else {
    appendIdx =
      source.getLastChildByKind(SyntaxKind.ImportDeclaration).getChildIndex() +
      1;
  }

  source.insertStatements(appendIdx, writer => {
    writer.newLine();
    writer.write(statement);
  });
  apply && source.saveSync();
}

export function findImportsDeclaration(source: SourceFile): ImportDeclaration[];

export function findImportsDeclaration(
  source: SourceFile,
  specifier: string
): ImportDeclaration;

// 获得所有导入声明
export function findImportsDeclaration(
  source: SourceFile,
  specifier?: string
): ImportDeclaration | ImportDeclaration[] {
  const importDeclarations = source
    .getFirstChildByKind(SyntaxKind.SyntaxList)
    .getChildrenOfKind(SyntaxKind.ImportDeclaration);

  if (specifier) {
    return importDeclarations.filter(imp => {
      const str = imp.getFirstChildByKind(SyntaxKind.StringLiteral);
      return str.getText() === `'${specifier}'`;
    })[0];
  }

  return importDeclarations;
}

// 获得导入声明的来源
export function findImportsSpecifier(source: SourceFile): string[] {
  const importDeclarations = findImportsDeclaration(source);

  const specifiers = importDeclarations
    .map(imp => imp.getFirstChildByKind(SyntaxKind.StringLiteral))
    // TODO: use RegExp
    .map(l => l.getText().replaceAll("'", ''));

  return specifiers;
}

// 新增具名导入成员
// 在importSpec不存在时，会新增一条具名导入
// 会过滤已存在的具名导入成员
export function addNamedImportsMember(
  source: SourceFile,
  importSpec: string,
  members: string[],
  apply = true
): void {
  const importDec = source
    .getFirstChildByKind(SyntaxKind.SyntaxList)
    .getChildrenOfKind(SyntaxKind.ImportDeclaration)
    .filter(importDec => {
      const importString = importDec
        .getFirstChildByKind(SyntaxKind.StringLiteral)
        .getText();
      return `'${importSpec}'` === importString;
    })[0];

  if (!importDec) {
    source.addImportDeclaration({
      moduleSpecifier: importSpec,
      namedImports: members,
    });
    apply && source.saveSync();

    return;
  }

  const importClause = importDec.getImportClause();
  const namedImports = importClause.getNamedImports().map(x => x.getText());

  const namedImportsCanBeAdded = members.filter(
    mem => !namedImports.includes(mem)
  );

  if (!namedImportsCanBeAdded.length) {
    return;
  }

  importDec.addNamedImports(namedImportsCanBeAdded);

  apply && source.saveSync();
}

// 更新默认导入的值
export function updateDefaultImportClause(
  source: SourceFile,
  specifier: string,
  updatedClause: string,
  apply = true
) {
  const sourceImportSpecifiers = findImportsSpecifier(source);

  if (!sourceImportSpecifiers.includes(specifier)) {
    consola.error(`Import from '${specifier}' does not exist!`);
    process.exit(0);
  }

  const targetImport = findImportsDeclaration(source, specifier);

  if (!targetImport.getDefaultImport()) {
    consola.error(`Import from '${specifier}' is not default import`);
    process.exit(0);
  }

  targetImport.setDefaultImport(updatedClause);

  apply && source.saveSync();
}

// 更新命名空间导入的值
export function updateNamespaceImportClause(
  source: SourceFile,
  specifier: string,
  updatedNamespace: string,
  apply = true
) {
  const sourceImportSpecifiers = findImportsSpecifier(source);

  if (!sourceImportSpecifiers.includes(specifier)) {
    consola.error(`Import from '${specifier}' does not exist!`);
    process.exit(0);
  }

  const targetImport = findImportsDeclaration(source, specifier);

  if (!targetImport.getNamespaceImport()) {
    consola.error(`Import from '${specifier}' is not namespace import`);
    process.exit(0);
  }

  targetImport.setNamespaceImport(updatedNamespace);

  apply && source.saveSync();
}

// 移除导入声明
export function removeImportDeclaration(
  source: SourceFile,
  specifiers: string[],
  apply = true
) {
  const sourceImports = findImportsSpecifier(source);

  const validSpecToRemove = specifiers.filter(spec =>
    sourceImports.includes(spec)
  );

  if (!validSpecToRemove.length) {
    return;
  }

  validSpecToRemove.forEach(spec => {
    const targetImport = findImportsDeclaration(source, spec);

    targetImport.remove();
  });

  apply && source.saveSync();
}

// 基于导入类型移除导入
export function removeImportDeclarationByTypes(
  source: SourceFile,
  removeByTypes?: Partial<Record<'namespace' | 'default' | 'named', boolean>>,
  apply = true
) {
  const sourceImports = findImportsDeclaration(source);

  sourceImports.forEach(imp => {
    if (removeByTypes?.default && isDefaultImport(imp)) {
      imp.remove();
      return;
    }

    if (removeByTypes?.named && isNamedImport(imp)) {
      imp.remove();
      return;
    }

    if (removeByTypes?.namespace && isNamespaceImport(imp)) {
      imp.remove();
      return;
    }
  });

  apply && source.saveSync();
}

// 更新导入的来源值
export function updateImportSpecifier(
  source: SourceFile,
  prevSpec: string,
  updatedSpec: string,
  apply = true
) {
  const sourceImportSpecifiers = findImportsSpecifier(source);

  if (!sourceImportSpecifiers.includes(prevSpec)) {
    consola.error(`Import from '${prevSpec}' does not exist!`);
    process.exit(0);
  }

  const targetImport = findImportsDeclaration(source, prevSpec);

  targetImport.setModuleSpecifier(updatedSpec);

  apply && source.saveSync();
}

// 检查是否是默认导入
export function isDefaultImport(importSpec: ImportDeclaration): boolean {
  return Boolean(importSpec.getDefaultImport());
}

// 检查是否是命名空间导入
export function isNamespaceImport(importSpec: ImportDeclaration): boolean {
  return Boolean(importSpec.getNamespaceImport());
}

// 检查是否是具名导入
export function isNamedImport(importSpec: ImportDeclaration): boolean {
  return Boolean(importSpec.getNamedImports().length);
}
