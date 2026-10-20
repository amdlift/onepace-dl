import type { Clock } from './clock';

export interface ScheduledJob {
	name: string;
	every: number;
	run(): Promise<void>;
}

const pollInterval = 30_000;

/**
 * Owns cadence. Takes a clock rather than reading one, so a test makes time pass explicitly
 * instead of waiting for it.
 */
export class Scheduler {
	#clock: Clock;
	#jobs = new Map<string, { job: ScheduledJob; dueAt: number }>();
	#timer: ReturnType<typeof setInterval> | null = null;

	constructor(clock: Clock) {
		this.#clock = clock;
	}

	add(job: ScheduledJob): void {
		this.#jobs.set(job.name, { job, dueAt: this.#clock.now().getTime() });
	}

	async tick(): Promise<void> {
		const now = this.#clock.now().getTime();
		for (const entry of this.#jobs.values()) {
			if (entry.dueAt <= now) await this.#run(entry.job);
		}
	}

	async runNow(name: string): Promise<void> {
		const entry = this.#jobs.get(name);
		if (entry === undefined) throw new Error(`nothing is scheduled under ${name}`);
		await this.#run(entry.job);
	}

	startPolling(): void {
		this.#timer ??= setInterval(() => void this.tick(), pollInterval);
		this.#timer.unref?.();
	}

	stop(): void {
		if (this.#timer !== null) clearInterval(this.#timer);
		this.#timer = null;
	}

	async #run(job: ScheduledJob): Promise<void> {
		const entry = this.#jobs.get(job.name);
		if (entry !== undefined) entry.dueAt = this.#clock.now().getTime() + job.every;
		try {
			await job.run();
		} catch (error) {
			console.error(`the ${job.name} job threw`, error);
		}
	}
}
