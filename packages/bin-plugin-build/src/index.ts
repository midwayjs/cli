import { BasePlugin } from '@midwayjs/command-core';
import { resolve, join, dirname } from 'path';
import { existsSync, readFileSync, remove } from 'fs-extra';
import { CompilerHost, Program, resolveTsConfigFile } from '@midwayjs/mwcc';
export class BuildPlugin extends BasePlugin {
  commands = {
    build: {
      lifecycleEvents: ['clean', 'copyFile', 'compile', 'emit'],
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
        entrypoint: {
          usage: 'bundle the source with the file given as entrypoint',
        },
        minify: {
          usage: '',
        },
        mode: {
          usage: 'bundle mode, "debug" or "release" (default)', // release
        },
        tsConfig: {
          usage: 'tsConfig json object data',
        },
      },
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
    const tsConfig = this.getTsConfig();
    const projectFile = this.getProjectFile();
    const outdir = this.getCompilerOptions(
      tsConfig,
      'outDir',
      dirname(projectFile)
    );
    await remove(outdir);
  }

  async compile() {
    const { cwd } = this.core;
    const { config } = resolveTsConfigFile(
      cwd,
      undefined,
      undefined,
      this.getStore('mwccHintConfig', 'global'),
      {
        compilerOptions: {
          sourceRoot: this.getTsCodeRoot(),
        },
      }
    );
    this.compilerHost = new CompilerHost(cwd, config);
    this.program = new Program(this.compilerHost);
  }

  async emit() {
    this.program.emit();
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

    if (tsConfig && tsConfig.compilerOptions) {
      return tsConfig.compilerOptions[optionKeyPath];
    }
  }

  private getProjectFile() {
    const { cwd } = this.core;
    const { project } = this.options;
    return resolve(cwd, project || 'tsconfig.json');
  }

  private getTsConfig() {
    if (this.tsConfig) {
      return this.tsConfig;
    }
    const { cwd } = this.core;
    const { tsConfig } = this.options;
    let tsConfigResult;
    if (typeof tsConfig === 'string') {
      try {
        tsConfigResult = JSON.parse(tsConfig);
      } catch (e) {
        console.log(
          `[midway-bin] tsConfig should be JSON string or Object: ${e.message}\n`
        );
        process.exit(1);
      }
    }
    const projectFile = this.getProjectFile();
    if (!tsConfigResult) {
      if (!existsSync(projectFile)) {
        console.log(`[midway-bin] tsconfig.json not found in ${cwd}\n`);
        process.exit(1);
      }
      try {
        tsConfigResult = JSON.parse(
          readFileSync(projectFile, 'utf-8').toString()
        );
      } catch {
        //
      }
    }
    this.tsConfig = tsConfigResult;
  }
}
