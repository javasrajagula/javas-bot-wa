import { env } from '../config/env.js';
import prisma from '../db/client.js';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

export interface QueueJob<T = any> {
  id: string;
  data: T;
  process?: () => Promise<void>;
  onSuccess?: () => void;
  onFailure?: (error: Error) => void;
  retries: number;
}

export interface QueueInterface {
  add(job: Omit<QueueJob, 'retries'>): Promise<void>;
  getLength(): Promise<number>;
  cancel(jobId: string): Promise<boolean>;
  status(jobId: string): Promise<'active' | 'waiting' | 'failed' | 'completed' | 'not_found'>;
  list(): Promise<any[]>;
  retry(jobId: string): Promise<boolean>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getActiveJobs(): Promise<any[]>;
  getFailedJobs(): Promise<any[]>;
  getCompletedJobs(): Promise<any[]>;
  isQueuePaused(): Promise<boolean>;
  getName(): string;
}

async function executeJob(type: string, data: any): Promise<void> {
  if (type === 'downloader') {
    const { processDownloaderJob } = await import('../commands/downloader.command.js');
    await processDownloaderJob(data);
  } else if (type === 'hd') {
    const { processHdJob } = await import('../commands/media/media.command.js');
    await processHdJob(data);
  } else {
    throw new Error(`Unknown job type: ${type}`);
  }
}

let redisConnection: Redis | null = null;
if (env.USE_REDIS) {
  redisConnection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
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

  public async getLength(): Promise<number> {
    return this.queue.length;
  }

  public async getActiveJobs(): Promise<QueueJob[]> {
    return this.activeJobs;
  }

  public async getFailedJobs(): Promise<QueueJob[]> {
    return this.failedJobs;
  }

  public async getCompletedJobs(): Promise<QueueJob[]> {
    return this.completedJobs;
  }

  public async isQueuePaused(): Promise<boolean> {
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
      const payloadMeta = dataMeta.payload || {};
      await prisma.queueJobRecord.upsert({
        where: { jobId: job.id },
        create: {
          jobId: job.id,
          queue: this.name,
          status: 'waiting',
          command: payloadMeta.command || dataMeta.type || null,
          groupId: payloadMeta.groupId || payloadMeta.chatId || null,
          userId: payloadMeta.userId || null,
          metadataJson: JSON.stringify(payloadMeta)
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
      if (job.process) {
        await job.process();
      } else {
        const { type, payload } = job.data;
        await executeJob(type, payload);
      }
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

export class RedisQueue implements QueueInterface {
  private queue: Queue;
  private worker: Worker;

  constructor(private name: string, concurrency = 1) {
    const queueName = name.replace(/\s+/g, '_');
    this.queue = new Queue(queueName, { connection: redisConnection as any });
    
    this.worker = new Worker(queueName, async (job) => {
      const { type, payload } = job.data;
      await executeJob(type, payload);
    }, {
      connection: redisConnection as any,
      concurrency
    });

    this.worker.on('active', async (job) => {
      await prisma.queueJobRecord.updateMany({
        where: { jobId: job.id },
        data: { status: 'active', updatedAt: new Date() }
      }).catch(() => {});
    });

    this.worker.on('completed', async (job) => {
      console.log(`[Queue: ${this.name}] Job ${job.id} succeeded`);
      await prisma.queueJobRecord.updateMany({
        where: { jobId: job.id },
        data: { status: 'completed', updatedAt: new Date() }
      }).catch(() => {});
    });

    this.worker.on('failed', async (job, err) => {
      console.error(`[Queue: ${this.name}] Job ${job?.id} failed:`, err);
      if (job) {
        await prisma.queueJobRecord.updateMany({
          where: { jobId: job.id },
          data: { status: 'failed', updatedAt: new Date() }
        }).catch(() => {});
      }
    });
  }

  public getName(): string {
    return this.name;
  }

  public async getLength(): Promise<number> {
    const count = await this.queue.getWaitingCount();
    return count;
  }

  public async getActiveJobs(): Promise<any[]> {
    const jobs = await this.queue.getActive();
    return jobs.map(j => ({ id: j.id || '', data: j.data, retries: j.attemptsMade }));
  }

  public async getFailedJobs(): Promise<any[]> {
    const jobs = await this.queue.getFailed();
    return jobs.map(j => ({ id: j.id || '', data: j.data, retries: j.attemptsMade }));
  }

  public async getCompletedJobs(): Promise<any[]> {
    const jobs = await this.queue.getCompleted();
    return jobs.map(j => ({ id: j.id || '', data: j.data, retries: j.attemptsMade }));
  }

  public async isQueuePaused(): Promise<boolean> {
    return this.queue.isPaused();
  }

  public async add(job: Omit<QueueJob, 'retries'>): Promise<void> {
    const dataMeta = job.data && typeof job.data === 'object' ? job.data : {};
    
    await this.queue.add(job.id, {
      type: dataMeta.type,
      payload: dataMeta.payload
    }, {
      jobId: job.id,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    });

    console.log(`[Queue: ${this.name}] Added job ${job.id} to BullMQ.`);

    try {
      const payloadMeta = dataMeta.payload || {};
      await prisma.queueJobRecord.upsert({
        where: { jobId: job.id },
        create: {
          jobId: job.id,
          queue: this.name,
          status: 'waiting',
          command: payloadMeta.command || dataMeta.type || null,
          groupId: payloadMeta.groupId || payloadMeta.chatId || null,
          userId: payloadMeta.userId || null,
          metadataJson: JSON.stringify(payloadMeta)
        },
        update: {
          status: 'waiting',
          updatedAt: new Date()
        }
      });
    } catch (dbErr) {
      console.error(`[Queue: ${this.name}] Failed to save job ${job.id} to DB:`, dbErr);
    }
  }

  public async cancel(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      await prisma.queueJobRecord.updateMany({
        where: { jobId },
        data: { status: 'cancelled', updatedAt: new Date() }
      }).catch(() => {});
      return true;
    }
    return false;
  }

  public async status(jobId: string): Promise<'active' | 'waiting' | 'failed' | 'completed' | 'not_found'> {
    const job = await this.queue.getJob(jobId);
    if (!job) return 'not_found';
    const state = await job.getState();
    if (state === 'active') return 'active';
    if (state === 'waiting' || state === 'delayed') return 'waiting';
    if (state === 'failed') return 'failed';
    if (state === 'completed') return 'completed';
    return 'not_found';
  }

  public async list(): Promise<any[]> {
    const jobs = await this.queue.getJobs(['waiting', 'active', 'delayed']);
    return jobs.map(j => ({
      id: j.id || '',
      data: j.data,
      retries: j.attemptsMade
    }));
  }

  public async retry(jobId: string): Promise<boolean> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.retry();
      await prisma.queueJobRecord.updateMany({
        where: { jobId },
        data: { status: 'waiting', updatedAt: new Date() }
      }).catch(() => {});
      return true;
    }
    return false;
  }

  public async pause(): Promise<void> {
    await this.queue.pause();
  }

  public async resume(): Promise<void> {
    await this.queue.resume();
  }
}

const driver = (process.env.QUEUE_DRIVER || (env.USE_REDIS ? 'redis' : 'memory')).toLowerCase();

export const hdQueue = driver === 'redis' 
  ? new RedisQueue('HD_Enhancement', 1) 
  : new MemoryQueue('HD_Enhancement', 1);

export const downloaderQueue = driver === 'redis' 
  ? new RedisQueue('Downloader', 2) 
  : new MemoryQueue('Downloader', 2);

export const generalQueue = driver === 'redis' 
  ? new RedisQueue('General', 3) 
  : new MemoryQueue('General', 3);

export function getAllQueues(): QueueInterface[] {
  return [hdQueue, downloaderQueue, generalQueue];
}
