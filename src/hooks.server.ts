import type { ServerInit } from '@sveltejs/kit/hooks';
import { getApp } from './lib/server/runtime';

export const init: ServerInit = async () => {
	await getApp().ready;
};
