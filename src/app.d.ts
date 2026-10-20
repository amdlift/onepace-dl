import type { AuthenticationState } from './lib/server/auth/service';

declare global {
	namespace App {
		interface Locals {
			authentication: AuthenticationState & { signedIn: boolean };
		}
	}
}

export {};
