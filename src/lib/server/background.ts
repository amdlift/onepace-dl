/** Yields the event loop between units of work, and says whether there is any point going on. */
export type Pause = () => Promise<boolean>;

type Work = (pause: Pause) => Promise<void>;

interface Outstanding {
	finished: Promise<void>;
}

/**
 * Work a form action starts without waiting for it, so a request returns while a long job carries
 * on. Takes the pause rather than reaching for the event loop itself, so a test drives it
 * explicitly instead of racing it, the way the Scheduler takes a clock.
 */
export class Background {
	#outstanding = new Set<Outstanding>();
	#parked = new Set<(carryOn: boolean) => void>();
	#held = false;
	#stopped = false;

	run(name: string, work: Work): void {
		const entry: Outstanding = { finished: Promise.resolve() };
		entry.finished = this.#perform(name, work).finally(() => {
			this.#outstanding.delete(entry);
		});
		this.#outstanding.add(entry);
	}

	/** Everything outstanding run to completion, including whatever it starts while running. */
	async settle(): Promise<void> {
		this.#held = false;
		this.#wakeParked();
		while (this.#outstanding.size > 0) {
			await Promise.all([...this.#outstanding].map((entry) => entry.finished));
		}
	}

	/** Parks outstanding work at its next pause, so a test can look at a job still under way. */
	async hold(): Promise<void> {
		this.#held = true;
		while (this.#parked.size < this.#outstanding.size) await yieldToTheLoop();
	}

	stop(): void {
		this.#stopped = true;
		this.#held = false;
		this.#wakeParked();
	}

	async #perform(name: string, work: Work): Promise<void> {
		try {
			await work(() => this.#pause());
		} catch (error) {
			console.error(`the ${name} work threw`, error);
		}
	}

	#pause(): Promise<boolean> {
		if (this.#stopped) return Promise.resolve(false);
		if (!this.#held) return yieldToTheLoop().then(() => !this.#stopped);
		return new Promise<boolean>((resolve) => this.#parked.add(resolve));
	}

	#wakeParked(): void {
		const parked = [...this.#parked];
		this.#parked.clear();
		for (const wake of parked) wake(!this.#stopped);
	}
}

const yieldToTheLoop = (): Promise<void> =>
	new Promise<void>((resolve) => void setImmediate(resolve));
