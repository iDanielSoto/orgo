import './index.css';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { LogProvider } from '@/components/forms/log';
import { AppShell } from '@/components/layout/app-shell';
import { ApiError } from '@/lib/api';
import { keys, useMe } from '@/lib/queries';
import { ActivityPage } from '@/pages/activity';
import { BodyPage } from '@/pages/body';
import { HabitsPage } from '@/pages/habits';
import { LoginPage } from '@/pages/login';
import { ProfilePage } from '@/pages/profile';
import { ProfileSetupPage } from '@/pages/profile-setup';
import { SettingsPage } from '@/pages/settings';
import { TodayPage } from '@/pages/today';

const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
  mutationCache: new MutationCache({
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  }),
});

function RequireAuth() {
  const me = useMe();
  const location = useLocation();
  React.useEffect(() => {
    document.documentElement.classList.add('dark');
  }, [me.data]);
  if (me.isPending) {
    return (
      <div className="min-h-dvh" />
    );
  }
  if (!me.data) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  if (!me.data.hasProfile && location.pathname !== '/configurar') return <Navigate to="/configurar" replace />;
  return <Outlet />;
}

function App() {
  return (
    <BrowserRouter>
      <LogProvider>
        <Routes>
          <Route path="/entrar" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/configurar" element={<ProfileSetupPage />} />
            <Route element={<AppShell />}>
              <Route index element={<TodayPage />} />
              <Route path="cuerpo" element={<BodyPage />} />
              <Route path="habitos" element={<HabitsPage />} />
              <Route path="actividad" element={<ActivityPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route path="ajustes" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </LogProvider>
    </BrowserRouter>
  );
}

// Service worker: necesario para recibir notificaciones push (en iPhone, con la app instalada).
if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-center"
        // En la PWA del iPhone el contenido pasa debajo de la barra de estado: los avisos bajan lo necesario.
        offset={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
        mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 10px)', left: 16, right: 16 }}
        toastOptions={{ className: 'font-sans', style: { background: 'var(--sheet)', color: 'var(--ink)', border: '1px solid var(--sep)', borderRadius: 18, backdropFilter: 'blur(14px)' } }}
      />
    </QueryClientProvider>
  </React.StrictMode>,
);
