import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const cost: Required<Pick<ScryptOptions, 'N' | 'r' | 'p'>> = { N: 16384, r: 8, p: 1 };
const keyLength = 64;
const saltLength = 16;

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(saltLength);
	const key = await derive(password, salt, keyLength, cost);
	return ['scrypt', cost.N, cost.r, cost.p, salt.toString('base64'), key.toString('base64')].join(
		'$'
	);
}

export async function passwordMatches(password: string, hash: string): Promise<boolean> {
	const [scheme, N = '', r = '', p = '', salt = '', key = ''] = hash.split('$');
	if (scheme !== 'scrypt' || key === '') return false;
	const expected = Buffer.from(key, 'base64');
	const offered = await derive(password, Buffer.from(salt, 'base64'), expected.length, {
		N: Number(N),
		r: Number(r),
		p: Number(p)
	});
	return timingSafeEqual(offered, expected);
}

const derive = (
	password: string,
	salt: Buffer,
	length: number,
	options: ScryptOptions
): Promise<Buffer> =>
	new Promise((resolve, reject) => {
		scrypt(password, salt, length, options, (error, key) =>
			error === null ? resolve(key) : reject(error)
		);
	});
