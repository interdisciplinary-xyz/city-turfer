import { SerialCommandExecutor } from '../command-executor';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('SerialCommandExecutor', () => {
  it('runs commands one at a time, in submission order', async () => {
    const q = new SerialCommandExecutor();
    const log: string[] = [];
    const cmd = (name: string, ms: number) => async () => {
      log.push(`${name}:start`);
      await new Promise((r) => setTimeout(r, ms));
      log.push(`${name}:end`);
      return name;
    };
    const results = await Promise.all([q.run(cmd('ingest', 20)), q.run(cmd('finish', 0)), q.run(cmd('late', 5))]);
    expect(results).toEqual(['ingest', 'finish', 'late']);
    expect(log).toEqual(['ingest:start', 'ingest:end', 'finish:start', 'finish:end', 'late:start', 'late:end']);
  });

  it('does not start a command before the previous one settled', async () => {
    const q = new SerialCommandExecutor();
    let release: () => void = () => undefined;
    const first = q.run(() => new Promise<void>((r) => (release = r)));
    const second = jest.fn(async () => 'second');
    const done = q.run(second);
    await tick();
    expect(second).not.toHaveBeenCalled();
    release();
    await first;
    expect(await done).toBe('second');
  });

  it('a failing command rejects its caller only; the queue keeps going', async () => {
    const q = new SerialCommandExecutor();
    const failing = q.run(async () => {
      throw new Error('boom');
    });
    const next = q.run(async () => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('takes the queue position synchronously at submission', async () => {
    const q = new SerialCommandExecutor();
    const order: number[] = [];
    await Promise.all([1, 2, 3].map((n) => q.run(async () => void order.push(n))));
    expect(order).toEqual([1, 2, 3]);
  });
});
