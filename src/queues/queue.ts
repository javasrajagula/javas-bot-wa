import { env } from '../config/env.js';
import prisma from '../db/client.js';

export interface QueueJob<T = any> {
  id: string;
  data: T;
  process: () => Promise<void>;
  onSuccess?: () => void;
  onFailure?: (error: Error) => void;
  retries: number;
}

export interface QueueInterface {
  add(job: Omit<QueueJob, 'retries'>): Promise<void>;
  getLength(): number;
  cancel(jobId: string): Promise<boolean>;
  status(jobId: string): Promise<'active' | 'waiting' | 'failed' | 'completed' | 'not_found'>;
  list(): Promise<QueueJob[]>;
  retry(jobId: string): Promise<boolean>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getActiveJobs(): QueueJob[];
  getFailedJobs(): QueueJob[];
  getCompletedJobs(): QueueJob[];
  isQueuePaused(): boolean;
  getName(): string;
}

export class MemoryQueue implements QueueInterface {
  private queue: QueueJob[] = [];
  private activeJobs: QueueJob[] = [];
  private failedJobs: QueueJob[] = [];
  private completedJobs: QueueJob[] = [];
  private maxConcurrency = 1;
  private isPaused = false;

  constructor(private name: string, maxConcurrency = 1) {
    this.maxConcurrency = maxConcurrency;
  }

  public getName(): string {
    return this.name;
  }

  public getLength(): number {
    return this.queue.length;
  }

  public getActiveJobs(): QueueJob[] {
    return this.activeJobs;
  }

  public getFailedJobs(): QueueJob[] {
    return this.failedJobs;
  }

  public getCompletedJobs(): QueueJob[] {
    return this.completedJobs;
  }

  public isQueuePaused(): boolean {
    return this.isPaused;
  }

  public async add(job: Omit<QueueJob, 'retries'>): Promise<void> {
    const fullJob: QueueJob = {
      ...job,
      retries: 0
    };
    this.queue.push(fullJob);
    console.log(`[Queue: ${this.name}] Added job ${job.id}. Current queue size: ${this.queue.length}`);

    // Persist to DB
    try {
      const dataMeta = job.data && typeof job.data === 'object' ? job.data : {};
      await prisma.queueJobRecord.upsert({
        where: { jobId: job.id },
        create: {
          jobId: job.id,
          queue: this.name,
          status: 'waiting',
          command: (dataMeta as any).command || null,
          groupId: (dataMeta as any).groupId || null,
          userId: (dataMeta as any).userId || null,
          metadataJson: JSON.stringify(dataMeta)
        },
        update: {
          status: 'waiting',
          updatedAt: new Date()
        }
      });
    } catch (dbErr) {
      console.error(`[Queue: ${this.name}] Failed to save job ${job.id} to DB:`, dbErr);
    }

    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.isPaused) return;
    if (this.activeJobs.length >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift()!;
    this.activeJobs.push(job);

    console.log(`[Queue: ${this.name}] Starting job ${job.id}`);

    // Update status to active in DB
    try {
      await prisma.queueJobRecord.updateMany({
        where: { jobId: job.id },
        data: { status: 'active', updatedAt: new Date() }
      });
    } catch (dbErr) {
      console.error(`[Queue: ${this.name}] Failed to update job ${job.id} to active:`, dbErr);
    }
    
    try {
      await job.process();
      console.log(`[Queue: ${this.name}] Job ${job.id} succeeded`);
      this.completedJobs.push(job);
      if (this.completedJobs.length > 50) this.completedJobs.shift();

      // Update status to completed in DB
      await prisma.queueJobRecord.updateMany({
        where: { jobId: job.id },
        data: { status: 'completed', updatedAt: new Date() }
      }).catch(() => {});

      if (job.onSuccess) job.onSuccess();
    } catch (err: any) {
      console.error(`[Queue: ${this.name}] Job ${job.id} failed:`, err);
      if (job.retries < 2) {
        job.retries++;
        console.log(`[Queue: ${this.name}] Retrying job ${job.id} (${job.retries}/2)`);
        this.queue.unshift(job);

        // Update status back to waiting/retry in DB
        await prisma.queueJobRecord.updateMany({
          where: { jobId: job.id },
          data: { status: 'waiting', updatedAt: new Date() }
        }).catch(() => {});
      } else {
        console.log(`[Queue: ${this.name}] Job ${job.id} exhausted all retries`);
        this.failedJobs.push(job);
        if (this.failedJobs.length > 50) this.failedJobs.shift();

        // Update status to failed in DB
        await prisma.queueJobRecord.updateMany({
          where: { jobId: job.id },
          data: { status: 'failed', updatedAt: new Date() }
        }).catch(() => {});

        if (job.onFailure) job.onFailure(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      this.activeJobs = this.activeJobs.filter(j => j.id !== job.id);
      this.processNext();
    }
  }

  public async cancel(jobId: string): Promise<boolean> {
    const initialLen = this.queue.length;
    this.queue = this.queue.filter(j => j.id !== jobId);
    if (this.queue.length < initialLen) {
      console.log(`[Queue: ${this.name}] Cancelled waiting job ${jobId}`);

      // Update status to cancelled in DB
      await prisma.queueJobRecord.updateMany({
        where: { jobId },
        data: { status: 'cancelled', updatedAt: new Date() }
      }).catch(() => {});

      return true;
    }
    return false;
  }

  public async status(jobId: string): Promise<'active' | 'waiting' | 'failed' | 'completed' | 'not_found'> {
    if (this.activeJobs.some(j => j.id === jobId)) return 'active';
    if (this.queue.some(j => j.id === jobId)) return 'waiting';
    if (this.failedJobs.some(j => j.id === jobId)) return 'failed';
    if (this.completedJobs.some(j => j.id === jobId)) return 'completed';
    return 'not_found';
  }

  public async list(): Promise<QueueJob[]> {
    return [...this.queue];
  }

  public async retry(jobId: string): Promise<boolean> {
    const failedJobIdx = this.failedJobs.findIndex(j => j.id === jobId);
    if (failedJobIdx > -1) {
      const job = this.failedJobs.splice(failedJobIdx, 1)[0];
      job.retries = 0;
      this.queue.push(job);
      this.processNext();
      return true;
    }
    return false;
  }

  public async pause(): Promise<void> {
    this.isPaused = true;
    console.log(`[Queue: ${this.name}] Paused`);
  }

  public async resume(): Promise<void> {
    this.isPaused = false;
    console.log(`[Queue: ${this.name}] Resumed`);
    this.processNext();
  }
}

// Separate queues per feature to avoid blockage
export const hdQueue = new MemoryQueue('HD_Enhancement', 1);
export const downloaderQueue = new MemoryQueue('Downloader', 2);
export const generalQueue = new MemoryQueue('General', 3);

export function getAllQueues(): QueueInterface[] {
  return [hdQueue, downloaderQueue, generalQueue];
}
