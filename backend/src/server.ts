import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import http from 'http';
import createApp from './app';
import { ENV } from './config/env';
import prisma from './config/prisma';
import { initSocket } from './socket/socket.service';

const app = createApp();

// Wrap Express in native Node HTTP server for WebSocket integration
const httpServer = http.createServer(app);

// Initialize Socket.io attached to the HTTP server
initSocket(httpServer);

const server = httpServer.listen(ENV.PORT, () => {
  console.log(`====================================================`);
  console.log(` SUIT & STITCH REAL-TIME BESPOKE PLATFORM RUNNING   `);
  console.log(` HTTP API:    http://localhost:${ENV.PORT}/api      `);
  console.log(` WebSockets:  ws://localhost:${ENV.PORT}           `);
  console.log(` Mode:        ${ENV.NODE_ENV}                       `);
  console.log(`====================================================`);
});

// Graceful process shutdown handling
async function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP and WebSocket server closed.');
    await prisma.$disconnect();
    console.log('Database connections closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
