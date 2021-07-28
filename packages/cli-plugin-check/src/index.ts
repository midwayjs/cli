import { BasePlugin } from '@midwayjs/command-core';
import { RunnerContainer, Runner } from '@midwayjs/luckyeye';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

enum ProjectType {
  FaaS = 'faas'
}

type RunnerItem = (runner : Runner) => void;

export class CheckPlugin extends BasePlugin {

  projectType: ProjectType;

  commands = {
    check: {
      usage: 'find your code bugs',
      lifecycleEvents: ['start', 'check', 'output'],
    },
  };

  hooks = {
    'check:start': this.start.bind(this),
    'check:check': this.check.bind(this),
  };

  async start() {
    // check project type
    const fyml = join(this.core.cwd, 'f.yml');
    if (existsSync(fyml)) {
      const yamlData = readFileSync(fyml).toString();
      if (/deployType/.test(yamlData)) {
        this.projectType = ProjectType.FaaS;
      }
    }
  }

  async check() {
    const container = new RunnerContainer();
    container.loadRulePackage();
    const ruleList = await this.getRuleList();
    console.log(`${ruleList.length} 项校验规则即将运行，请稍后`);
    for(const rule of ruleList) {
      container.addRule(rule);
    }
    await container.run();
  }

  async getRuleList(): Promise<Array<RunnerItem>> {
    const ruleList: RunnerItem[] = [];
    if (this.options.checkRule) {
      const ruleList = [].concat(this.options.checkRule);
      for(const getRule of ruleList) {
        const rule = await getRule();
        ruleList.push(rule);
      }
    }

    if (this.projectType === ProjectType.FaaS) {
      ruleList.push(
        await this.ruleFaaSDecorator(),
        this.ruleFYaml(),
      )
    }

    return ruleList;
  }

  async ruleFaaSDecorator(): Promise<RunnerItem> {
    // 校验是否存在 decorator 重名
    // 校验 @Logger 装饰器所在class是否被继承
    return  (runner) => {

    }
  }

  // 校验yaml格式
  ruleFYaml(): RunnerItem {
    // yaml 配置

    return (runner) => {

    }
  }

  ruleTSConfig(): RunnerItem {
    // target 2018
    return (runner) => {

    }
  }
  
}
