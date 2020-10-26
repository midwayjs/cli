import { loadSpec, writeToSpec } from '../src/';
import * as assert from 'assert';
import { tmpdir } from 'os';
describe('/test/utils.test.ts', () => {
  it('loadSpec', async () => {
    const spec = loadSpec(__dirname);
    assert(spec && spec.provider && spec.provider.name === 'ginkgo');
  });
  it('writeToSpec', async () => {
    const result: any = writeToSpec(tmpdir(), {});
    assert(Object.keys(result).length === 0);
    const spec = loadSpec(__dirname);
    writeToSpec(__dirname, spec);
  });
});
