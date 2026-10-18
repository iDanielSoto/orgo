import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';
import { Item, List, Switch } from '@/components/ui/ios';
import { api } from '@/lib/api';
import { currentSubscription, isIOS, isStandalone, pushSupported, subscribe, unsubscribe } from '@/lib/push';
import { useAction } from '@/lib/queries';

interface NotificationsInfo {
  configured: boolean;
  publicKey: string | null;
  devices: number;
  preferences: { kind: 'TRAINING' | 'HYDRATION' | 'BEDTIME' | 'WEIGH_IN'; label: string; enabled: boolean }[];
}

export function NotificationsSection() {
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<NotificationsInfo>('/notifications') });
  const sub = useQuery({ queryKey: ['notifications', 'device'], queryFn: async () => Boolean(await currentSubscription()) });
  const [busy, setBusy] = React.useState(false);
  const toggle = useAction((v: { kind: string; enabled: boolean }) => api.put('/notifications/preferences', v), { invalidate: [['notifications']] });
  const test = useAction(() => api.post('/push/test'), { success: 'Notificación de prueba enviada', invalidate: [] });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const activate = async () => {
    setBusy(true);
    try {
      await subscribe(info.data!.publicKey!);
      toast.success('Notificaciones activadas');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudieron activar');
    } finally {
      setBusy(false);
    }
  };
  const deactivate = async () => {
    setBusy(true);
    try {
      await unsubscribe();
      refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!info.data) return null;
  let blocker: string | null = null;
  if (!info.data.configured) blocker = 'No disponibles en este servidor';
  else if (isIOS() && !isStandalone()) blocker = 'Agrega la app a tu pantalla de inicio para activarlas';
  else if (!pushSupported()) blocker = 'Este navegador no las admite';
  else if (Notification.permission === 'denied') blocker = 'Bloqueadas en los ajustes del teléfono';

  return (
    <List header="Notificaciones">
      {blocker ? (
        <Item label={<span className="text-ink-2">{blocker}</span>} />
      ) : !sub.data ? (
        <Item label={<span className="text-tint">{busy ? 'Activando…' : 'Activar notificaciones'}</span>} onClick={busy ? undefined : activate} />
      ) : (
        <>
          {info.data.preferences.map((p) => (
            <Switch key={p.kind} label={p.label} checked={p.enabled} onChange={(enabled) => toggle.mutate({ kind: p.kind, enabled })} />
          ))}
          <Item label="Enviar una de prueba" onClick={() => test.mutate(undefined)} />
          <Item label="Desactivar en este teléfono" destructive onClick={busy ? undefined : deactivate} />
        </>
      )}
    </List>
  );
}
