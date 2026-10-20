import { parseHTML } from 'linkedom';

/** One rendered Pacerr page, queried the way a person reads it: by what it says. */
export class PacerrPage {
	readonly #document: Document;

	constructor(
		readonly status: number,
		readonly html: string
	) {
		this.#document = parseHTML(html).document as unknown as Document;
	}

	get document(): Document {
		return this.#document;
	}

	/** Visible text, whitespace collapsed. Defaults to the whole page. */
	text(selector = 'body'): string {
		return collapse(this.#document.querySelector(selector)?.textContent ?? '');
	}

	texts(selector: string): string[] {
		return [...this.#document.querySelectorAll(selector)].map((node) =>
			collapse(node.textContent ?? '')
		);
	}

	attributes(selector: string, name: string): (string | null)[] {
		return [...this.#document.querySelectorAll(selector)].map((node) => node.getAttribute(name));
	}
}

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();
