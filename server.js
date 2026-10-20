import { createServer } from 'node:http';
import { handler } from './build/handler.js';
import { declareConnectionProtocol } from './src/lib/connection-protocol.ts';

const server = createServer((request, response) => {
	declareConnectionProtocol(request);
	handler(request, response, () => {
		response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
	});
});

server.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '0.0.0.0', () => {
	console.log(`Pacerr is listening on ${process.env.HOST ?? '0.0.0.0'}:${process.env.PORT ?? 3000}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
