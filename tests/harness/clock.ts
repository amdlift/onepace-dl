import type { Clock } from '../../src/lib/server/clock';

export class ManualClock implements Clock {
	#now: Date;

	constructor(start: Date) {
		this.#now = start;
	}

	now(): Date {
		return new Date(this.#now);
	}

	advance(milliseconds: number): void {
		this.#now = new Date(this.#now.getTime() + milliseconds);
	}
}

export const seconds = (count: number): number => count * 1000;
export const minutes = (count: number): number => seconds(count) * 60;
export const hours = (count: number): number => minutes(count) * 60;
export const days = (count: number): number => hours(count) * 24;
