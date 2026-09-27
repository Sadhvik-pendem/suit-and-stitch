import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { ENV } from './config/env';

export function createApp(): Application {
  const app = express();

  // Cross-Origin Resource Sharing configured for browser fetch + cookies
  app.use(
    cors({
      origin: ENV.CORS_ORIGIN === '*' ? true : ENV.CORS_ORIGIN,
      credentials: true,
    })
  );

  // Body and cookie parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Top-level Health check for monitoring and cloud deployment probes
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Suit & Stitch Bespoke API',
      database: 'connected',
    });
  });

  // Mount API Gateway routes under /api
  app.use('/api', routes);

  // Serve Frontend files directly across development and production
  const path = require('path');
  const fs = require('fs');
  const possiblePaths = [
    path.resolve(__dirname, '../../frontend'),
    path.resolve(process.cwd(), '../frontend'),
    path.resolve(process.cwd(), 'frontend'),
    path.resolve(__dirname, '../frontend'),
  ];
  const frontendPath = possiblePaths.find((p: string) => fs.existsSync(p)) || possiblePaths[0];

  app.use(express.static(frontendPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}

export default createApp;
