const { existsSync, writeFileSync, readFileSync } = require('fs');
const { ensureFileSync } = require('fs-extra');
const { join, relative } = require('path');
const { create } = require(process.env.MW_CLI_TS_NODE);
const m = require('module');

const md5 = require('md5');
function register() {
  const old = m._extensions['.js'];
  const service = create();
  const cacheDir = join(process.cwd(), 'node_modules/.midway_bin_cache');
  m._extensions['.ts'] = function (m, filename) {
    const _compile = m._compile;
    m._compile = function (code, fileName) {
      const relativePath = relative(process.env.MW_CLI_SOURCE_DIR, fileName);
      const cachePath = join(cacheDir, relativePath);
      const cacheHashPath = join(cacheDir, relativePath + '_mw_ts_hash');
      let compiledCode = code;
      const codeHash = md5(code);
      let isUseCache = false;
      if (existsSync(cacheHashPath)) {
        const cacheHash = readFileSync(cacheHashPath, 'utf-8');
        if (cacheHash === codeHash) {
          isUseCache = true;
          compiledCode = readFileSync(cachePath, 'utf-8');
        }
      }
      if (!isUseCache) {
        compiledCode = service.compile(code, fileName);
        ensureFileSync(cachePath);
        writeFileSync(cachePath, compiledCode);
        writeFileSync(cacheHashPath, codeHash);
      }
      return _compile.call(this, compiledCode, fileName);
    };
    return old(m, filename);
  };
}
register();
