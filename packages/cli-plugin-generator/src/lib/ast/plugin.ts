import { SourceFile } from 'ts-morph';
import { getExistClassMethodsDeclaration } from './class';
import {
  getLifeCycleClass,
  getLifeCycleClassMethods,
  ensureLifeCycleMethods,
  ensureLifeCycleClassPropertyWithMidwayDecorator,
  getLifeCycleClassMethodDeclaration,
} from './configuration';

export function insertFunctionBodyStatement(
  source: SourceFile,
  functionIdentifier: string,
  statements: string[],
  apply = true
) {
  const method = getExistClassMethodsDeclaration(
    source,
    'ContainerConfiguration',
    functionIdentifier
  );

  method.addStatements(statements);
}

// add to onReady
// this.app.use
export function addPluginUse(
  source: SourceFile,
  pluginIdentifier: string,
  apply = true
) {
  ensureLifeCycleMethods(source, ['onReady'], false);
  ensureLifeCycleClassPropertyWithMidwayDecorator(source, 'app', 'App', false);

  const onReadyMethod = getLifeCycleClassMethodDeclaration(source, 'onReady');

  // TODO: support specify insert position
  onReadyMethod.insertStatements(
    0,
    `this.app.use(await this.app.generateMiddleware("${pluginIdentifier}"))`
  );

  apply && source.saveSync();
}
