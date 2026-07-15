import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

const ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	try {
		return await bcrypt.compare(password, hash);
	} catch {
		return false;
	}
}

const WORDS = [
	'amber',
	'basalt',
	'cobalt',
	'delta',
	'ember',
	'flint',
	'granite',
	'harbor',
	'ivory',
	'jasper',
	'kelp',
	'lumen',
	'marble',
	'nickel',
	'onyx',
	'pyrite',
	'quartz',
	'ridge',
	'slate',
	'topaz'
];
const SYMBOLS = '!@#$%&*';
// no ambiguous chars (0/O, 1/l/I)
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Human-friendly temporary password for seeded users / admin resets. Uses the
 * CSPRNG (node:crypto randomInt) — never Math.random — and ~50 bits of entropy.
 */
export function generateTempPassword(): string {
	const word = () => WORDS[randomInt(WORDS.length)];
	const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
	const suffix = Array.from({ length: 3 }, () => ALNUM[randomInt(ALNUM.length)]).join('');
	const digits = randomInt(1000, 10000);
	const sym = SYMBOLS[randomInt(SYMBOLS.length)];
	return `${cap(word())}-${word()}-${word()}${digits}${sym}${suffix}`;
}
