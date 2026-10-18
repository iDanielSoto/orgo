import { Router } from 'express';
import { deleteAccountSchema } from '@forma/core';
import { prisma } from '../db';
import { destroySession, uid, verifyPassword } from '../lib/auth';
import { HttpError, parse } from '../lib/http';

export const accountRouter = Router();

/** Exportación completa de los datos del usuario (sin credenciales ni sesiones). */
accountRouter.get('/account/export', async (req, res) => {
  const userId = uid(req);
  const where = { userId };
  const [user, profile, health, settings, goals, measurements, beverages, hydrationGoals, meals, sleep, workouts, walks, habits, completions, reviews, notifications] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, createdAt: true } }),
      prisma.userProfile.findUnique({ where, omit: { avatar: true } }),
      prisma.healthProfile.findUnique({ where }),
      prisma.userSettings.findUnique({ where }),
      prisma.goal.findMany({ where }),
      prisma.bodyMeasurement.findMany({ where, orderBy: { measuredAt: 'asc' } }),
      prisma.beverageLog.findMany({ where, orderBy: { loggedAt: 'asc' } }),
      prisma.hydrationGoal.findMany({ where }),
      prisma.meal.findMany({ where, include: { items: true }, orderBy: { eatenAt: 'asc' } }),
      prisma.sleepLog.findMany({ where, orderBy: { wakeTime: 'asc' } }),
      prisma.workoutSession.findMany({ where, include: { sets: true } }),
      prisma.walkingSession.findMany({ where }),
      prisma.habit.findMany({ where }),
      prisma.habitCompletion.findMany({ where }),
      prisma.weeklyReview.findMany({ where }),
      prisma.notificationPreference.findMany({ where }),
    ]);
  const [finAccounts, finIncomes, finTransactions, finRules, finBudgetTransfers, finCategories] = await Promise.all([
    prisma.financialAccount.findMany({ where }),
    prisma.income.findMany({ where }),
    prisma.transaction.findMany({ where, orderBy: { localDate: 'asc' } }),
    prisma.budgetRule.findMany({ where }),
    prisma.budgetTransfer.findMany({ where }),
    prisma.financeCategory.findMany({ where }),
  ]);
  res.setHeader('Content-Disposition', `attachment; filename="ordo-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({
    exportedAt: new Date().toISOString(),
    units: { weight: 'kg', length: 'cm', volume: 'ml', energy: 'kcal', duration: 'min' },
    user,
    profile,
    health,
    settings,
    goals,
    measurements,
    beverages,
    hydrationGoals,
    meals,
    sleep,
    workouts,
    walks,
    habits,
    habitCompletions: completions,
    weeklyReviews: reviews,
    notificationPreferences: notifications,
    finance: {
      currency: 'MXN (importes en centavos)',
      accounts: finAccounts,
      incomes: finIncomes,
      transactions: finTransactions,
      budgetRules: finRules,
      budgetTransfers: finBudgetTransfers,
      categories: finCategories,
    },
  });
});

/** Elimina la cuenta y TODOS sus datos (cascada). Requiere contraseña y confirmación explícita. */
accountRouter.delete('/account', async (req, res) => {
  const userId = uid(req);
  const { password } = parse(deleteAccountSchema, req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, 'Contraseña incorrecta');
  await prisma.user.delete({ where: { id: userId } });
  await destroySession(req, res);
  res.status(204).end();
});
