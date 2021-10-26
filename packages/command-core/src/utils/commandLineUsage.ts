export const commandLineUsage = (options, prefix?) => {
  if (Array.isArray(options)) {
    return options
      .map(options => {
        return commandLineUsage(options, prefix);
      })
      .join('\n');
  }
  const currentPrefix = prefix?.prefix || '';
  const result = ['\n'];
  if (options.header) {
    result.push(currentPrefix + (prefix?.command || '') + options.header);

    if (options.content) {
      result.push(currentPrefix + `  ${options.content}`);
    }
    result[result.length - 1] = result[result.length - 1] + '\n';
  }
  const optionsList = [];
  let length = 0;
  if (options.optionList) {
    options.optionList.map(info => {
      const option = `  ${info.alias ? `--${info.alias}, ` : ''}--${info.name}`;
      if (option.length > length) {
        length = option.length + 4;
      }
      optionsList.push({
        option,
        info: info.description || '',
      });
    });
  }
  optionsList.forEach(options => {
    result.push(
      currentPrefix + options.option.padEnd(length, ' ') + options.info + '\n'
    );
  });

  if (Array.isArray(options.childCommands) && options.childCommands.length) {
    result.push(
      commandLineUsage(options.childCommands, {
        prefix: currentPrefix + '',
        command:
          (prefix?.command || '') +
          (options.header ? `${options.header} ` : ''),
      })
    );
  }
  return result.join('\n');
};
