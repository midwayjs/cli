import { exec as cpExec, ExecException } from 'child_process';
export const exec = (options: {
  cmd: string;
  baseDir?: string;
  slience?: boolean;
  log?: (...msg: any[]) => void;
}): Promise<string | ExecException> => {
  const { cmd, baseDir, slience, log } = options;
  return new Promise((resolved, rejected) => {
    const execProcess = cpExec(
      cmd,
      {
        cwd: baseDir,
      },
      (err, result) => {
        if (err) {
          return rejected(err);
        }
        resolved(result);
      }
    );
    execProcess.stdout.on('data', data => {
      if (!slience) {
        (log || console.log)(data);
      }
    });
  });
};
