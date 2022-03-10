import {
  BasePlugin,
  forkNode,
  resolveMidwayConfig,
} from '@midwayjs/command-core';
import { resolve, join, dirname, relative } from 'path';
import {
  existsSync,
  move,
  readFileSync,
  remove,
  writeFileSync,
} from 'fs-extra';
import { CompilerHost, Program, resolveTsConfigFile } from '@midwayjs/mwcc';
import { copyFiles } from '@midwayjs/faas-code-analysis';
import * as globby from 'globby';
import * as ts from 'typescript';
import { tmpdir } from 'os';
export class BuildPlugin extends BasePlugin {
  isMidwayHooks = false;
  private midwayBinBuild: { include?: string[] } = {};
  private midwayCliConfig: any = {};
  commands = {
    build: {
      lifecycleEvents: [
        'formatOptions',
        'clean',
        'copyFile',
        'compile',
        'emit',
        'bundle',
        'complete',
      ],
      options: {
        clean: {
          usage: 'clean build target dir',
          shortcut: 'c',
        },
        project: {
          usage: 'project file location',
          shortcut: 'p',
        },
        srcDir: {
          usage: 'source code path',
        },
        outDir: {
          usage: 'build out path',
        },
        tsConfig: {
          usage: 'json string / file path / object',
        },
        buildCache: {
          usage: 'save build cache',
        },
        exclude: {
          usage: 'copy file exclude',
        },
        include: {
          usage: 'copy file include',
        },
        bundle: {
          usage: 'bundle to one file',
        },
      },
    },
  };

  hooks = {
    'build:formatOptions': this.formatOptions.bind(this),
    'build:clean': this.clean.bind(this),
    'build:copyFile': this.copyFile.bind(this),
    'build:compile': this.compile.bind(this),
    'build:emit': this.emit.bind(this),
    'build:bundle': this.bundle.bind(this),
    'build:complete': this.complete.bind(this),
  };

  private compilerHost: CompilerHost;
  private program: Program;

  async formatOptions() {
    const config = resolveMidwayConfig(this.core.cwd);
    if (config.exist) {
      this.isMidwayHooks = true;
      this.options.srcDir = config.source;
    }

    const packageJsonPath = join(this.core.cwd, 'package.json');
    if (existsSync(packageJsonPath)) {
      const pkgJson = JSON.parse(readFileSync(packageJsonPath).toString());
      this.midwayBinBuild = pkgJson['midway-bin-build'] || {};
      this.midwayCliConfig = pkgJson['midway-cli'] || {};
    }
  }

  async clean() {
    if (!this.options.clean) {
      return;
    }
    const outdir = this.getOutDir();
    if (existsSync(outdir)) {
      await remove(outdir);
    }
  }

  private getOutDir(): string {
    if (this.options.outDir) {
      return this.options.outDir;
    }
    const tsConfig = this.getTsConfig();
    this.core.debug('TSConfig', tsConfig);
    const projectFile = this.getProjectFile();
    this.core.debug('ProjectFile', projectFile);
    return (
      this.getCompilerOptions(tsConfig, 'outDir', dirname(projectFile)) ||
      'dist'
    );
  }

  async copyFile() {
    const outDir = this.getOutDir();
    this.core.debug('CopyFile TargetDir', outDir);
    const exclude = this.options.exclude ? this.options.exclude.split(',') : [];
    const sourceDir = join(this.core.cwd, this.options.srcDir || 'src');
    const targetDir = join(this.core.cwd, outDir);
    await copyFiles({
      sourceDir,
      targetDir,
      defaultInclude: this.midwayBinBuild.include
        ? this.midwayBinBuild.include
        : ['**/*'],
      exclude: ['**/*.ts', '**/*.js'].concat(exclude),
      log: path => {
        this.core.cli.log(`   - Copy ${path}`);
      },
    });

    // midway core DEFAULT_IGNORE_PATTERN
    let include = [
      '**/public/**/*.js',
      '**/view/**/*.js',
      '**/views/**/*.js',
      '**/app/extend/**/*.js',
    ];
    if (this.options.include !== undefined) {
      include = this.options.include ? this.options.include.split(',') : [];
    }

    if (include.length) {
      await copyFiles({
        sourceDir,
        targetDir,
        defaultInclude: include,
        exclude,
        log: path => {
          this.core.cli.log(`   - Copy ${path}`);
        },
      });
    }
    this.core.cli.log('   - Copy Complete');
  }

  async compile() {
    const rootDir = this.getTsCodeRoot();
    this.core.debug('rootDir', rootDir);
    const outDir = this.getOutDir();
    this.core.debug('outDir', outDir);
    const { cwd } = this.core;
    const { config } = resolveTsConfigFile(
      cwd,
      undefined,
      this.options.tsConfig,
      this.getStore('mwccHintConfig', 'global'),
      this.isMidwayHooks
        ? {
            compilerOptions: {
              sourceRoot: rootDir,
              rootDir,
              outDir,
            },
            include: [rootDir],
          }
        : {
            compilerOptions: {
              sourceRoot: rootDir,
            },
          }
    );
    this.core.debug('Compile TSConfig', config);
    this.compilerHost = new CompilerHost(cwd, config);
    this.program = new Program(this.compilerHost);
  }

  async emit() {
    const { diagnostics } = await this.program.emit();
    if (diagnostics?.length) {
      const error = diagnostics.find(diagnostic => {
        return diagnostic.category === ts.DiagnosticCategory.Error;
      });
      if (error) {
        const errorPath = `(${relative(this.core.cwd, error.file.fileName)})`;
        if (!this.midwayCliConfig?.experimentalFeatures?.ignoreTsError) {
          throw new Error(`TS Error: ${error.messageText}${errorPath}`);
        }
      }
    }

    // clear build cache
    if (!this.options.buildCache) {
      const { cwd } = this.core;
      const outDir = this.getOutDir();
      const cacheList = [
        join(cwd, outDir, '.mwcc-cache'),
        join(cwd, outDir, 'midway.build.json'),
      ];
      for (const cacheFile of cacheList) {
        if (existsSync(cacheFile)) {
          await remove(cacheFile);
        }
      }
    }
  }

  private getTsCodeRoot(): string {
    return resolve(this.core.cwd, this.options.srcDir || 'src');
  }

  private getCompilerOptions(tsConfig, optionKeyPath, projectDir) {
    // if projectFile extended and without the option,
    // get setting from its parent
    if (tsConfig && tsConfig.extends) {
      if (
        !tsConfig.compilerOptions ||
        (tsConfig.compilerOptions && !tsConfig.compilerOptions[optionKeyPath])
      ) {
        return this.getCompilerOptions(
          require(join(projectDir, tsConfig.extends)),
          optionKeyPath,
          { projectDir }
        );
      }
    }

    return tsConfig?.compilerOptions?.[optionKeyPath];
  }

  private getProjectFile() {
    const { cwd } = this.core;
    const { project } = this.options;
    return resolve(cwd, project || 'tsconfig.json');
  }

  private getTsConfig() {
    const { cwd } = this.core;
    this.core.debug('CWD', cwd);
    let { tsConfig } = this.options;
    let tsConfigResult;
    if (typeof tsConfig === 'string') {
      // if ts config is file
      if (existsSync(tsConfig)) {
        tsConfig = readFileSync(tsConfig).toString();
      }
      try {
        tsConfigResult = JSON.parse(tsConfig);
      } catch (e) {
        console.log('[midway-bin] tsConfig should be JSON string or Object');
        throw e;
      }
    }
    const projectFile = this.getProjectFile();
    if (!tsConfigResult) {
      if (!existsSync(projectFile)) {
        console.log(`[ Midway ] tsconfig.json not found in ${cwd}\n`);
        throw new Error('tsconfig.json not found');
      }
      try {
        tsConfigResult = JSON.parse(
          readFileSync(projectFile, 'utf-8').toString()
        );
      } catch (e) {
        console.log('[ Midway ] Read TsConfig Error', e.message);
        throw e;
      }
    }
    return tsConfigResult;
  }

  async bundle() {
    if (!this.options.bundle) {
      return;
    }
    const nccPkgJsonFile = require.resolve('@vercel/ncc/package');
    const nccPkgJson = JSON.parse(readFileSync(nccPkgJsonFile).toString());
    const nccCli = join(nccPkgJsonFile, '../', nccPkgJson.bin.ncc);
    const outDir = join(this.core.cwd, this.getOutDir());

    let preloadCode = '// midway bundle';
    const preloadFile = 'midway_bundle_entry.js';
    const requireList = await globby(['**/*.js'], {
      cwd: outDir,
    });

    preloadCode += requireList
      .map((file, index) => {
        return `require('./${file}');`;
      })
      .join('\n');

    const configurationFilePath = join(outDir, 'configuration.js');
    if (existsSync(configurationFilePath)) {
      preloadCode += `
      const configuration = require('./configuration.js');
      if (typeof configuration === 'object') {
        const configurationKey = Object.keys(configuration).find(key => typeof configuration[key] === 'function');
        if (configurationKey) {
          exports.configuration = configuration[configurationKey];
        }
      } else {
        exports.configuration = configuration;
      }
      `;
    }
    writeFileSync(join(outDir, preloadFile), preloadCode);

    this.core.cli.log('Build bundle...');
    await forkNode(
      nccCli,
      ['build', preloadFile, '-o', 'ncc_build_tmp', '-m'],
      {
        cwd: outDir,
      }
    );
    const tmpFile = join(tmpdir(), `midway_bundle_${Date.now()}.js`);
    await move(join(outDir, 'ncc_build_tmp/index.js'), tmpFile);
    await remove(outDir);
    await move(tmpFile, join(outDir, 'bundle.js'));
    await remove(tmpFile);
    this.core.cli.log(
      `Success compile to ${relative(
        process.cwd(),
        join(outDir, 'bundle.js')
      )}.`
    );
    this.core.cli.log(
      'You can use it through the configurationModule parameter in the bootstrap file.'
    );
  }

  async complete() {
    this.core.cli.log('Build Complete!');
  }
}
