import { BasePlugin } from '@midwayjs/command-core';
import { resolve } from 'path';
import { existsSync, readFileSync, remove } from 'fs-extra';
import {
  CompilerHost,
  Program,
  resolveTsConfigFile,
} from '@midwayjs/mwcc';
export class BuildPlugin extends BasePlugin {
  command = {
    build: {
      lifecycleEvents: [
        'clean',
        'copyFile',
        'compile',
        'emit'
      ],
      options: {
        clean: {
          usage: 'clean build target dir',
          shortcut: 'c',
        },
        project: {
          usage: 'project file location',
          shortcut: 'p'
        },
        srcDir: {
          usage: 'source code path',
        },
        entrypoint: {
          description: 'bundle the source with the file given as entrypoint',
          type: 'string',
          default: '',
        },
        minify: {
          type: 'boolean',
        },
        mode: {
          description: 'bundle mode, "debug" or "release" (default)',
          type: 'string',
          default: 'release',
        },
        tsConfig: {
          description: 'tsConfig json object data',
          type: 'object',
        },
      }
    },
  };

  hooks = {
    'build:clean': this.clean.bind(this),
    'build:compile': this.compile.bind(this),
    'build:emit': this.emit.bind(this),
  };

  private compilerHost: CompilerHost;
  private program: Program;
  private tsConfig;

  async clean() {
    if (!this.options.clean) {
      return;
    }
    const outdir = this.getTsConfig('outDir');
    await remove(outdir);
  }

  async compile() {

    const { config } = resolveTsConfigFile(
      this.core.cwd,
      undefined,
      undefined,
      this.getStore('mwccHintConfig', 'global'),
      {
        compilerOptions: {
          sourceRoot: this.getTsCodeRoot(),
        },
      }
    );
    this.compilerHost = new CompilerHost(this.core.cwd, config);
    this.program = new Program(this.compilerHost);
    console.log(this.core);
  }

  async emit() {
    this.program.emit();
  }

  private getTsCodeRoot(): string {
    return resolve(this.core.cwd, this.options.srcDir || 'src');
  }

  private getTsConfig() {
    if (this.tsConfig) {
      return this.tsConfig;
    }
    const { cwd } = this.core;
    const { project, tsConfig } = this.options;
    let tsConfigResult;
    if (typeof tsConfig === 'string') {
      try {
        tsConfigResult = JSON.parse(tsConfig);
      } catch (e) {
        console.log(`[midway-bin] tsConfig should be JSON string or Object: ${e.message}\n`);
        process.exit(1);
      }
    }
    const projectFile = resolve(cwd, project || 'tsconfig.json');
    if (!tsConfigResult) {
      if (!existsSync(projectFile)) {
        console.log(`[midway-bin] tsconfig.json not found in ${cwd}\n`);
        process.exit(1);
      }
      try {
        tsConfigResult = JSON.parse(readFileSync(projectFile, 'utf-8').toString());
      } catch {
        //
      }
    }
    this.tsConfig = tsConfigResult;
  }
}
