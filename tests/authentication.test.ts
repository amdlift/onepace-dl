import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { startPacerr, type Pacerr } from './harness/pacerr';

const account = { username: 'captain', password: 'all-blue-or-bust' };

async function requiringLogin(): Promise<Pacerr> {
	const pacerr = await startPacerr();
	await pacerr.submit('/settings/security', 'saveAuthentication', { enabled: 'on', ...account });
	pacerr.forget();
	return pacerr;
}

const routesDirectory = fileURLToPath(new URL('../src/routes', import.meta.url));

/** Every path SvelteKit serves, read off the route tree so a route added later is covered too. */
function everyRoute(directory = routesDirectory, prefix = ''): string[] {
	const entries = readdirSync(directory, { withFileTypes: true });
	const servedHere = entries.some(
		(entry) => entry.isFile() && (entry.name === '+page.svelte' || entry.name === '+server.ts')
	);
	const nested = entries
		.filter((entry) => entry.isDirectory())
		.flatMap((entry) =>
			everyRoute(
				join(directory, entry.name),
				entry.name.startsWith('(') ? prefix : `${prefix}/${entry.name}`
			)
		);
	return [...(servedHere ? [prefix === '' ? '/' : prefix] : []), ...nested];
}

function everyFileUnder(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
		entry.isDirectory()
			? everyFileUnder(join(directory, entry.name))
			: [join(directory, entry.name)]
	);
}

const configVolumeBytes = (pacerr: Pacerr): string =>
	everyFileUnder(pacerr.paths.config)
		.map((file) => readFileSync(file).toString('latin1'))
		.join('\n');

describe('authentication', () => {
	it('is off on a fresh install', async () => {
		const pacerr = await startPacerr();

		const page = await pacerr.open('/');

		expect(page.status).toBe(200);
		expect(page.text()).toContain('Romance Dawn');
	});

	it('gates Pacerr once it is turned on from Settings', async () => {
		const pacerr = await requiringLogin();

		const response = await pacerr.fetch('/', { redirect: 'manual' });

		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toContain('/login');
		expect(await response.text()).not.toContain('Romance Dawn');
	});

	it('lets the configured account in', async () => {
		const pacerr = await requiringLogin();

		await pacerr.submit('/login', 'logIn', account);

		expect((await pacerr.open('/')).text()).toContain('Romance Dawn');
	});

	it('turns away the wrong password', async () => {
		const pacerr = await requiringLogin();

		await pacerr.submit('/login', 'logIn', { username: 'captain', password: 'not-it' });

		expect((await pacerr.fetch('/', { redirect: 'manual' })).status).toBe(303);
	});

	it('gates every view and every HTTP route behind the session cookie', async () => {
		const pacerr = await requiringLogin();
		const routes = everyRoute().filter((route) => route !== '/login');
		expect(routes).toContain('/settings');

		const attempts = [
			...routes.map((route) => ({ path: route, method: 'GET' })),
			...routes.map((route) => ({
				path: route === '/' ? '/__data.json' : `${route}/__data.json`,
				method: 'GET'
			})),
			...routes.map((route) => ({ path: `${route}?/anyAction`, method: 'POST' })),
			{ path: '/?/refreshCatalogue', method: 'POST' },
			{ path: '/a/route/nobody/has/written/yet', method: 'GET' }
		];

		const asAForm = {
			'content-type': 'application/x-www-form-urlencoded',
			origin: pacerr.url
		};

		for (const { path, method } of attempts) {
			const response = await pacerr.fetch(path, {
				method,
				redirect: 'manual',
				...(method === 'POST' ? { headers: asAForm } : {})
			});
			const body = await response.text();
			const sentTo = response.headers.get('location') ?? body;
			expect(`${method} ${path} sent to ${sentTo}`).toContain('/login');
			expect(body).not.toContain('Romance Dawn');
		}
	});

	it('keeps you logged in across a container restart', async () => {
		const pacerr = await requiringLogin();
		await pacerr.submit('/login', 'logIn', account);

		await pacerr.restart();

		expect((await pacerr.open('/')).text()).toContain('Romance Dawn');
	});

	it('never writes the password to the config volume in plain text', async () => {
		const pacerr = await requiringLogin();

		expect(configVolumeBytes(pacerr)).not.toContain(account.password);
	});

	it('can be turned off again from Settings', async () => {
		const pacerr = await requiringLogin();
		await pacerr.submit('/login', 'logIn', account);

		await pacerr.submit('/settings/security', 'saveAuthentication', {});
		pacerr.forget();

		expect((await pacerr.open('/')).text()).toContain('Romance Dawn');
	});
});

describe('credentials given by environment variable', () => {
	it('require a login without anything being set in Settings', async () => {
		const pacerr = await startPacerr({ authentication: account });

		expect((await pacerr.fetch('/', { redirect: 'manual' })).status).toBe(303);

		await pacerr.submit('/login', 'logIn', account);
		expect((await pacerr.open('/')).text()).toContain('Romance Dawn');
	});

	it('are never copied into the config volume', async () => {
		const pacerr = await startPacerr({ authentication: account });
		await pacerr.submit('/login', 'logIn', account);

		expect(configVolumeBytes(pacerr)).not.toContain(account.password);
	});

	it('take the place of the Settings ones, which can no longer be changed', async () => {
		const pacerr = await startPacerr({ authentication: account });
		await pacerr.submit('/login', 'logIn', account);

		const page = await pacerr.submit('/settings/security', 'saveAuthentication', {
			enabled: 'on',
			username: 'impostor',
			password: 'sneaky'
		});

		expect(page.text()).toContain('environment variable');
		pacerr.forget();
		await pacerr.submit('/login', 'logIn', { username: 'impostor', password: 'sneaky' });
		expect((await pacerr.fetch('/', { redirect: 'manual' })).status).toBe(303);
	});
});

describe('the one account', () => {
	it('is replaced by Settings rather than joined by a second one', async () => {
		const pacerr = await requiringLogin();
		await pacerr.submit('/login', 'logIn', account);

		await pacerr.submit('/settings/security', 'saveAuthentication', {
			enabled: 'on',
			username: 'navigator',
			password: 'tangerines'
		});
		pacerr.forget();

		await pacerr.submit('/login', 'logIn', account);
		expect((await pacerr.fetch('/', { redirect: 'manual' })).status).toBe(303);

		await pacerr.submit('/login', 'logIn', { username: 'navigator', password: 'tangerines' });
		expect((await pacerr.open('/')).text()).toContain('Romance Dawn');
	});

	it('cannot be created from the login page', async () => {
		const pacerr = await requiringLogin();

		const page = (await pacerr.open('/login')).text().toLowerCase();

		expect(page).not.toContain('register');
		expect(page).not.toContain('sign up');
		expect(page).not.toContain('create an account');
	});
});
