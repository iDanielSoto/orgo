import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from './api';
import type {
  ActivityEntry,
  ActivityPlan,
  BodySummary,
  DayScore,
  Habit,
  HabitStat,
  HydrationDay,
  HydrationGoal,
  HydrationHistoryDay,
  Me,
  Meal,
  Measurement,
  Profile,
  SleepEntry,
  Today,
} from './types';

export const keys = {
  me: ['me'] as const,
  today: ['today'] as const,
  day: (date: string) => ['today', date] as const,
  days: (from: string, to: string) => ['days', from, to] as const,
  profile: ['profile'] as const,
  measurements: ['measurements'] as const,
  body: ['body'] as const,
  hydrationDay: (date?: string) => ['hydration', 'day', date ?? 'today'] as const,
  hydrationHistory: (days: number) => ['hydration', 'history', days] as const,
  hydrationGoals: ['hydration', 'goals'] as const,
  habits: ['habits'] as const,
  habitStats: (days: number) => ['habits', 'stats', days] as const,
  archivedHabits: ['habits', 'archived'] as const,
  meals: (date?: string) => ['meals', date ?? 'today'] as const,
  mealsDays: (days: number) => ['meals', 'days', days] as const,
  sleep: (days: number) => ['sleep', days] as const,
  activityPlan: ['activity', 'plan'] as const,
  activity: (days: number) => ['activity', 'list', days] as const,
};

export const useMe = () =>
  useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api.get<Me>('/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
  });

export const useToday = () => useQuery({ queryKey: keys.today, queryFn: () => api.get<Today>('/today'), refetchInterval: 5 * 60_000 });
/** El resumen de un día pasado (sin fecha = hoy, con refresco periódico). */
export const useDay = (date: string | null) =>
  useQuery({
    queryKey: date ? keys.day(date) : keys.today,
    queryFn: () => api.get<Today>(`/today${date ? `?date=${date}` : ''}`),
    refetchInterval: date ? false : 5 * 60_000,
  });
export const useDays = (from: string, to: string) =>
  useQuery({ queryKey: keys.days(from, to), queryFn: () => api.get<DayScore[]>(`/days?from=${from}&to=${to}`), placeholderData: (prev) => prev });
export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => api.get<Profile>('/profile') });
export const useMeasurements = () =>
  useQuery({ queryKey: keys.measurements, queryFn: () => api.get<Measurement[]>('/measurements') });
export const useBodySummary = () => useQuery({ queryKey: keys.body, queryFn: () => api.get<BodySummary>('/body/summary') });
export const useHydrationDay = (date?: string) =>
  useQuery({
    queryKey: keys.hydrationDay(date),
    queryFn: () => api.get<HydrationDay>(`/hydration/day${date ? `?date=${date}` : ''}`),
  });
export const useHydrationHistory = (days: number) =>
  useQuery({ queryKey: keys.hydrationHistory(days), queryFn: () => api.get<HydrationHistoryDay[]>(`/hydration/history?days=${days}`) });
export const useHydrationGoals = () =>
  useQuery({ queryKey: keys.hydrationGoals, queryFn: () => api.get<HydrationGoal[]>('/hydration/goals') });
export const useHabits = () => useQuery({ queryKey: keys.habits, queryFn: () => api.get<Habit[]>('/habits') });
export const useHabitStats = (days: number) =>
  useQuery({ queryKey: keys.habitStats(days), queryFn: () => api.get<HabitStat[]>(`/habits/stats?days=${days}`) });
export const useArchivedHabits = () =>
  useQuery({ queryKey: keys.archivedHabits, queryFn: () => api.get<Omit<Habit, 'today' | 'week'>[]>('/habits/archived') });
export const useMeals = (date?: string) =>
  useQuery({ queryKey: keys.meals(date), queryFn: () => api.get<Meal[]>(`/meals${date ? `?date=${date}` : ''}`) });
export const useMealsDays = (days: number) =>
  useQuery({ queryKey: keys.mealsDays(days), queryFn: () => api.get<Meal[]>(`/meals?days=${days}`) });
export const useSleep = (days: number) =>
  useQuery({ queryKey: keys.sleep(days), queryFn: () => api.get<SleepEntry[]>(`/sleep?days=${days}`) });
export const useActivityPlan = () =>
  useQuery({ queryKey: keys.activityPlan, queryFn: () => api.get<ActivityPlan>('/activity/plan') });
export const useActivity = (days: number) =>
  useQuery({ queryKey: keys.activity(days), queryFn: () => api.get<ActivityEntry[]>(`/activity?days=${days}`) });

/**
 * Mutación genérica: muestra confirmación o error y refresca las vistas
 * afectadas (los registros alimentan varias pantallas a la vez).
 */
export function useAction<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string | ((r: TResult, v: TVars) => string); invalidate?: QueryKey[]; onSuccess?: (r: TResult, v: TVars) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r, v) : opts.success);
      opts.onSuccess?.(r, v);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : 'Ocurrió un error');
    },
    onSettled: () => {
      for (const k of opts.invalidate ?? ALL_DATA) void qc.invalidateQueries({ queryKey: k });
    },
  });
}

/** Casi cualquier registro influye en Mi día y en los hábitos automáticos. */
export const ALL_DATA: QueryKey[] = [
  keys.today,
  ['days'],
  ['hydration'],
  ['habits'],
  keys.body,
  keys.measurements,
  ['meals'],
  ['sleep'],
  ['activity'],
  keys.profile,
];
