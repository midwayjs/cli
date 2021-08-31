import {
  transform,
  SpecBuilder,
  generate,
  filterUserDefinedEnv,
  loadSpec,
  writeToSpec,
} from '../src';
import * as path from 'path';
import * as assert from 'assert';
import * as fs from 'fs';
import * as mm from 'mm';
import { ensureFileSync, remove } from 'fs-extra';

describe('/test/index.test.ts', () => {
  describe('test all format', () => {
    it('test transform yml', () => {
      const result = transform(path.join(__dirname, './fixtures/fun.yml'));
      assert(result['functions']['hello']['handler'] === 'index.handler');
    });

    it('test transform yaml', () => {
      const result = transform(path.join(__dirname, './fixtures/fun.yaml'));
      assert(result['functions']['hello']['handler'] === 'index.handler');
    });

    it('test add variable for yml', () => {
      mm(process.env, 'FAAS_PROVIDER', 'fc');
      mm(process.env, 'FN_HANDLER', 'index.handler');
      mm(process.env, 'FN_HTTP_PATH', '/foo');
      mm(process.env, 'FN_HTTP_METHOD', 'get');
      const result = transform(path.join(__dirname, './fixtures/fun-var.yml'));
      assert(result['provider']['name'] === 'fc');
      assert(result['provider']['runtime'] === '${ env.NODEJS_VERSION }');
      assert(result['functions']['hello']['events'][0].http.path === '/foo');
      assert(result['functions']['hello']['events'][0].http.method === 'get');
      mm.restore();
    });
  });

  describe('test custom builder', () => {
    it('test use custom builder', () => {
      class CustomBuilder extends SpecBuilder {
        getTest() {
          return {
            test: {
              hello: 'test',
            },
          };
        }

        toJSON() {
          return {
            ...this.getTest(),
          };
        }
      }

      const result = transform(
        path.join(__dirname, './fixtures/fun.yml'),
        CustomBuilder
      );
      assert(result['test']['hello'] === 'test');
    });
  });

  describe('test generate file', () => {
    it('test generate test.yml', () => {
      generate(path.join(__dirname, './fixtures/fun.yml'), 'test.yml');
      assert(fs.existsSync(path.join(__dirname, './fixtures/test.yml')));
      fs.unlinkSync(path.join(__dirname, './fixtures/test.yml'));
    });
  });

  describe('export function', () => {
    it('filterUserDefinedEnv', () => {
      mm(process.env, 'UDEV_NODE_ENV', 'prod');
      const env = filterUserDefinedEnv();
      assert(env['NODE_ENV'] === 'prod');
      mm.restore();
    });
    it('loadSpec', () => {
      const spec = loadSpec(path.join(__dirname, './fixtures/yaml-test'));
      assert(spec.name === 'test');
    });
    it('no spec', () => {
      const spec = loadSpec(path.join(__dirname, './fixtures/not-exists-dir'));
      assert(Object.keys(spec).length === 0);
    });
    it('writeToSpec', async () => {
      const testYamlDir = path.join(__dirname, './fixtures/tmp-test-yaml-dir');
      const testYamlFile = path.join(testYamlDir, 'f.yaml');
      await ensureFileSync(testYamlFile);
      const data = Date.now();
      writeToSpec(testYamlDir, { data });
      const writedData = loadSpec(testYamlDir);
      await remove(testYamlDir);
      assert(writedData.data === data);
    });
  });
});
