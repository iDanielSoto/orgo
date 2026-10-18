import { createApp } from './app';
import { prisma } from './db';
import { env } from './env';
import { startReminderScheduler } from './services/push';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`FORMA API escuchando en http://localhost:${env.PORT}`);
});

const stopReminders = startReminderScheduler();

// Limpieza periódica de sesiones expiradas.
const cleanup = setInterval(
  () => void prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined),
  6 * 3600_000,
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearInterval(cleanup);
    stopReminders();
    server.close(() => void prisma.$disconnect().then(() => process.exit(0)));
  });
}
