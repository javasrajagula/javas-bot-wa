import { env } from '../config/env.js';

export interface QueueJob<T = any> {
  id: string;
  data: T;
  process: () => Promise<void>;
  onSuccess?: () => void;
  onFailure?: (error: Error) => void;
  retries: number;
}

class MemoryQueue {
  private queue: QueueJob[] = [];
  private activeJobsCount = 0;
  private maxConcurrency = 1;

  constructor(private name: string, maxConcurrency = 1) {
    this.maxConcurrency = maxConcurrency;
  }

  public async add(job: Omit<QueueJob, 'retries'>): Promise<void> {
    const fullJob: QueueJob = {
      ...job,
      retries: 0
    };
    this.queue.push(fullJob);
    console.log(`[Queue: ${this.name}] Added job ${job.id}. Current queue size: ${this.queue.length}`);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.activeJobsCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift()!;
    this.activeJobsCount++;

    console.log(`[Queue: ${this.name}] Starting job ${job.id}`);
    
    try {
      await job.process();
      console.log(`[Queue: ${this.name}] Job ${job.id} succeeded`);
      if (job.onSuccess) job.onSuccess();
    } catch (err: any) {
      console.error(`[Queue: ${this.name}] Job ${job.id} failed:`, err);
      if (job.retries < 2) {
        job.retries++;
        console.log(`[Queue: ${this.name}] Retrying job ${job.id} (${job.retries}/2)`);
        this.queue.unshift(job); // Put back to front for retry
      } else {
        console.log(`[Queue: ${this.name}] Job ${job.id} exhausted all retries`);
        if (job.onFailure) job.onFailure(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      this.activeJobsCount--;
      this.processNext();
    }
  }

  public getLength(): number {
    return this.queue.length;
  }
}

// Separate queues per feature to avoid blockage
export const hdQueue = new MemoryQueue('HD_Enhancement', 1);
export const downloaderQueue = new MemoryQueue('Downloader', 2);
export const generalQueue = new MemoryQueue('General', 3);
