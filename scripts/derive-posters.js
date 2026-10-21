import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const sourcesDirectory = join(repoRoot, 'artwork-sources');
const artworkDirectory = join(repoRoot, 'artwork');

const library = { directory: 'library', extension: 'jpg', width: 1000, height: 1500 };
const view = { directory: 'view', extension: 'webp', width: 300, height: 450 };

const manifest = JSON.parse(readFileSync(join(artworkDirectory, 'posters.json'), 'utf8'));

const mapped = new Set(manifest.posters.map((poster) => poster.source));
const present = new Set(readdirSync(sourcesDirectory).filter((name) => name.endsWith('.png')));

const unmapped = [...present].filter((name) => !mapped.has(name)).sort();
if (unmapped.length > 0) {
	console.error('No manifest entry names these sources. Add one per Arc, by hand:');
	for (const name of unmapped) console.error(`  ${name}`);
	process.exit(1);
}

const missing = [...mapped].filter((name) => !present.has(name)).sort();
if (missing.length > 0) {
	console.error(`Missing from ${sourcesDirectory}. Run scripts/fetch-poster-sources.sh first:`);
	for (const name of missing) console.error(`  ${name}`);
	process.exit(1);
}

for (const variant of [library, view]) {
	mkdirSync(join(artworkDirectory, variant.directory), { recursive: true });
}

const derived = (variant, name) =>
	join(artworkDirectory, variant.directory, `${name}.${variant.extension}`);

let total = 0;
for (const poster of manifest.posters) {
	const source = join(sourcesDirectory, poster.source);

	const libraryPath = derived(library, poster.name);
	await sharp(source)
		.resize(library.width, library.height, { fit: 'cover' })
		.jpeg({ quality: 80, mozjpeg: true, chromaSubsampling: '4:2:0' })
		.toFile(libraryPath);

	const viewPath = derived(view, poster.name);
	await sharp(source)
		.resize(view.width, view.height, { fit: 'cover' })
		.webp({ quality: 75 })
		.toFile(viewPath);

	const bytes = statSync(libraryPath).size + statSync(viewPath).size;
	total += bytes;
	console.log(`${poster.arc.padEnd(56)} ${(bytes / 1024).toFixed(0).padStart(6)} KiB`);
}

console.log(`${manifest.posters.length} Posters, ${(total / 1024 / 1024).toFixed(1)} MiB`);
