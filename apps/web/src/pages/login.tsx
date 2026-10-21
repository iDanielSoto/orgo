import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Capsule, List, TextItem } from '@/components/ui/ios';
import { HeatWord } from '@/components/portfolio';
import { api, ApiError } from '@/lib/api';
import { keys, useMe } from '@/lib/queries';

export function LoginPage() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (me.data) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/login', { email, password });
      await qc.invalidateQueries({ queryKey: keys.me });
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo entrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-5">
      <HeatWord text="Hola" className="mb-10 text-[64px] font-bold leading-none tracking-[-0.04em]" />
      <List>
        <TextItem type="email" autoComplete="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextItem type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
      </List>
      {error && <p role="alert" className="mt-4 text-center text-[15px] text-red">{error}</p>}
      <div className="mt-8 flex justify-center">
        <Capsule type="submit" disabled={busy || !email || !password} className="disabled:opacity-40">
          {busy ? 'Entrando…' : 'Entrar'}
        </Capsule>
      </div>
    </form>
  );
}
