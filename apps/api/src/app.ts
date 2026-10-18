import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { env } from './env';
import { originGuard, requireAuth } from './lib/auth';
import { errorHandler, HttpError } from './lib/http';
import { accountRouter } from './routes/account';
import { activityRouter } from './routes/activity';
import { authRouter } from './routes/auth';
import { cronRouter } from './routes/cron';
import { bodyRouter } from './routes/body';
import { habitsRouter } from './routes/habits';
import { hydrationRouter } from './routes/hydration';
import { logsRouter } from './routes/logs';
import { notificationsRouter } from './routes/notifications';
import { profileRouter } from './routes/profile';
import { todayRouter } from './routes/today';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  // El disparador de recordatorios necesita el cuerpo sin procesar para verificar la firma.
  app.use('/api/cron', cronRouter);
  // La foto de perfil viaja como data URL: límite propio, mayor que el general.
  app.use('/api/profile/avatar', express.json({ limit: '450kb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(originGuard);

  // Los datos de salud nunca se guardan en cachés intermedias.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/api/auth', authRouter);

  const api = Router();
  api.use(requireAuth);
  api.use(todayRouter, profileRouter, bodyRouter, hydrationRouter, habitsRouter, logsRouter, activityRouter, accountRouter, notificationsRouter);
  app.use('/api', api);

  app.use('/api', () => {
    throw new HttpError(404, 'Ruta no encontrada');
  });
  app.use(errorHandler);
  return app;
}
