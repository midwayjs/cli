import { commonPrefix } from '../src/aggregation';
import * as assert from 'assert';
describe('/test/commonPrefix.test.ts', () => {
  describe('commonPrefix', () => {
    it('/', async () => {
      const prefix = commonPrefix(['/api/index', '/api/api2', '/']);
      assert(prefix === '');
    });
    it('/*', async () => {
      const prefix = commonPrefix(['/api/index', '/api/api2', '//*']);
      assert(prefix === '');
    });
    it('/*', async () => {
      const prefix = commonPrefix(['/api/index', '/api/api2', '/api']);
      assert(prefix === '');
    });
    it('/api', async () => {
      const prefix = commonPrefix(['/api/index', '/api/api2']);
      assert(prefix === '/api');
    });
    it('/api', async () => {
      const prefix = commonPrefix(['/api/index/', '/api/index']);
      assert(prefix === '/api');
    });
    it('/api/index', async () => {
      const prefix = commonPrefix(['/api/index/', '/api/index/2']);
      assert(prefix === '/api/index');
    });
  });
});
