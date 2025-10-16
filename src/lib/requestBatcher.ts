type BatchRequest<T> = {
  key: string;
  resolve: (value: T) => void;
  reject: (error: any) => void;
};

class RequestBatcher<T> {
  private queue: Map<string, BatchRequest<T>[]> = new Map();
  private timeoutId: NodeJS.Timeout | null = null;
  private readonly batchDelay: number;
  private readonly batchFn: (keys: string[]) => Promise<Map<string, T>>;

  constructor(
    batchFn: (keys: string[]) => Promise<Map<string, T>>,
    batchDelay: number = 50
  ) {
    this.batchFn = batchFn;
    this.batchDelay = batchDelay;
  }

  request(key: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const existing = this.queue.get(key);
      if (existing) {
        existing.push({ key, resolve, reject });
      } else {
        this.queue.set(key, [{ key, resolve, reject }]);
      }

      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }

      this.timeoutId = setTimeout(() => {
        this.flush();
      }, this.batchDelay);
    });
  }

  private async flush() {
    if (this.queue.size === 0) return;

    const currentQueue = new Map(this.queue);
    this.queue.clear();
    this.timeoutId = null;

    const keys = Array.from(currentQueue.keys());

    try {
      const results = await this.batchFn(keys);

      currentQueue.forEach((requests, key) => {
        const result = results.get(key);
        requests.forEach(req => {
          if (result !== undefined) {
            req.resolve(result);
          } else {
            req.reject(new Error(`No result for key: ${key}`));
          }
        });
      });
    } catch (error) {
      currentQueue.forEach(requests => {
        requests.forEach(req => req.reject(error));
      });
    }
  }
}

export function createRequestBatcher<T>(
  batchFn: (keys: string[]) => Promise<Map<string, T>>,
  batchDelay?: number
): (key: string) => Promise<T> {
  const batcher = new RequestBatcher(batchFn, batchDelay);
  return (key: string) => batcher.request(key);
}
