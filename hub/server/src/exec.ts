import { spawn } from 'node:child_process';

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  input?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

/** Lance un programme sans shell et collecte sa sortie. */
export function run(command: string, args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: opts.cwd, env: opts.env ?? process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (d) => (stdout += d));
    child.stderr.setEncoding('utf8').on('data', (d) => (stderr += d));
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          stderr += `\n[timeout après ${opts.timeoutMs} ms]`;
          child.kill('SIGTERM');
        }, opts.timeoutMs)
      : undefined;
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(opts.input ?? '');
  });
}

/** Comme run, mais rejette si le code de sortie n'est pas 0. */
export async function runOk(command: string, args: string[], opts: RunOptions = {}): Promise<string> {
  const r = await run(command, args, opts);
  if (r.code !== 0) throw new Error(`${command} ${args.join(' ')} : ${(r.stderr || r.stdout).trim()}`);
  return r.stdout;
}
