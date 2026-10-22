/**
 * Figura de líneas que hace cada ejercicio en bucle (vista de lado, mirando a la derecha).
 * Cada ejercicio tiene dos poses —inicio y fin— y se interpola entre ellas al ritmo de la
 * rutina: va en 2 s, regresa en 1 s. Lo que trabaja se pinta en azul. Sin imágenes externas:
 * funciona sin internet y toma el color del tema.
 */
import * as React from 'react';

type P = [number, number];
type Joint = 'head' | 'shoulder' | 'elbow' | 'hand' | 'hip' | 'knee' | 'ankle' | 'toe' | 'elbow2' | 'hand2' | 'knee2' | 'ankle2' | 'toe2';
type Pose = Partial<Record<Joint, P>> & Record<'head' | 'shoulder' | 'elbow' | 'hand' | 'hip' | 'knee' | 'ankle' | 'toe', P>;
type Part = 'torso' | 'upperArm' | 'forearm' | 'thigh' | 'shin' | 'glute';
type Prop = 'chair' | 'table' | 'support' | 'backpack';

interface Move {
  a: Pose;
  b: Pose;
  works: Part[];
  /** Qué trabaja, en palabras. */
  label: string;
  props?: Prop[];
}

const FLOOR = 160;

export const MOVES: Record<string, Move> = {
  'Sentadilla a silla': {
    label: 'Piernas y glúteos',
    works: ['thigh', 'glute'],
    props: ['chair'],
    a: { head: [121, 38], shoulder: [120, 52], elbow: [142, 54], hand: [164, 54], hip: [120, 98], knee: [121, 130], ankle: [120, 160], toe: [134, 160] },
    b: { head: [130, 76], shoulder: [122, 89], elbow: [146, 89], hand: [168, 89], hip: [92, 124], knee: [124, 128], ankle: [120, 160], toe: [134, 160] },
  },
  'Flexión inclinada': {
    label: 'Pecho, hombros y brazos',
    works: ['upperArm', 'forearm'],
    props: ['table'],
    a: { head: [160, 64], shoulder: [150, 74], elbow: [156, 96], hand: [162, 118], hip: [111, 112], knee: [88, 134], ankle: [64, 158], toe: [72, 160] },
    b: { head: [170, 90], shoulder: [158, 98], elbow: [138, 110], hand: [162, 118], hip: [116, 125], knee: [90, 141], ankle: [64, 158], toe: [72, 160] },
  },
  'Puente de glúteos': {
    label: 'Glúteos y parte posterior del muslo',
    works: ['glute', 'thigh'],
    a: { head: [40, 149], shoulder: [56, 152], elbow: [76, 156], hand: [96, 157], hip: [105, 152], knee: [128, 128], ankle: [140, 158], toe: [152, 160] },
    b: { head: [40, 149], shoulder: [56, 152], elbow: [76, 156], hand: [96, 157], hip: [108, 124], knee: [138, 124], ankle: [140, 158], toe: [152, 160] },
  },
  'Bird dog': {
    label: 'Abdomen, espalda baja y glúteos',
    works: ['torso', 'glute'],
    a: { head: [156, 114], shoulder: [140, 124], elbow: [140, 141], hand: [140, 158], hip: [90, 126], knee: [90, 158], ankle: [60, 158], toe: [54, 160] },
    b: {
      head: [156, 114],
      shoulder: [140, 124],
      elbow: [164, 120],
      hand: [188, 117],
      hip: [90, 126],
      knee: [60, 124],
      ankle: [30, 122],
      toe: [24, 126],
      elbow2: [140, 141],
      hand2: [140, 158],
      knee2: [90, 158],
      ankle2: [60, 158],
      toe2: [54, 160],
    },
  },
  'Zancada asistida': {
    label: 'Piernas y glúteos',
    works: ['thigh', 'glute'],
    props: ['support'],
    a: {
      head: [103, 36],
      shoulder: [102, 50],
      elbow: [124, 64],
      hand: [148, 74],
      hip: [102, 96],
      knee: [118, 128],
      ankle: [130, 158],
      toe: [142, 160],
      elbow2: [98, 74],
      hand2: [100, 96],
      knee2: [90, 128],
      ankle2: [74, 152],
      toe2: [66, 160],
    },
    b: {
      head: [101, 64],
      shoulder: [100, 78],
      elbow: [124, 82],
      hand: [148, 80],
      hip: [100, 124],
      knee: [132, 124],
      ankle: [130, 158],
      toe: [142, 160],
      elbow2: [96, 100],
      hand2: [98, 120],
      knee2: [88, 156],
      ankle2: [60, 152],
      toe2: [54, 160],
    },
  },
  'Remo con mochila': {
    label: 'Espalda y brazos',
    works: ['torso', 'upperArm'],
    props: ['backpack'],
    a: { head: [148, 62], shoulder: [135, 70], elbow: [136, 94], hand: [137, 118], hip: [100, 100], knee: [114, 130], ankle: [110, 160], toe: [124, 160] },
    b: { head: [148, 62], shoulder: [135, 70], elbow: [113, 80], hand: [122, 99], hip: [100, 100], knee: [114, 130], ankle: [110, 160], toe: [124, 160] },
  },
  'Bisagra de cadera': {
    label: 'Glúteos y parte posterior del muslo',
    works: ['glute', 'thigh'],
    a: { head: [111, 36], shoulder: [110, 50], elbow: [122, 72], hand: [114, 94], hip: [110, 96], knee: [111, 128], ankle: [110, 160], toe: [124, 160] },
    b: { head: [144, 78], shoulder: [131, 84], elbow: [112, 96], hand: [94, 100], hip: [88, 100], knee: [106, 130], ankle: [110, 160], toe: [124, 160] },
  },
  'Dead bug': {
    label: 'Abdomen',
    works: ['torso'],
    a: { head: [40, 147], shoulder: [56, 150], elbow: [58, 126], hand: [60, 102], hip: [104, 150], knee: [106, 118], ankle: [136, 118], toe: [144, 114] },
    b: {
      head: [40, 147],
      shoulder: [56, 150],
      elbow: [36, 134],
      hand: [18, 120],
      hip: [104, 150],
      knee: [134, 140],
      ankle: [164, 146],
      toe: [172, 142],
      elbow2: [58, 126],
      hand2: [60, 102],
      knee2: [106, 118],
      ankle2: [136, 118],
      toe2: [144, 114],
    },
  },
};

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Completa las extremidades de atrás: si no se indican, siguen a las de delante. */
function full(p: Pose): Required<Pose> {
  return { ...p, elbow2: p.elbow2 ?? p.elbow, hand2: p.hand2 ?? p.hand, knee2: p.knee2 ?? p.knee, ankle2: p.ankle2 ?? p.ankle, toe2: p.toe2 ?? p.toe };
}

function mix(a: Pose, b: Pose, t: number): Required<Pose> {
  const fa = full(a);
  const fb = full(b);
  return Object.fromEntries((Object.keys(fa) as Joint[]).map((k) => [k, lerp(fa[k], fb[k], t)])) as Required<Pose>;
}

/** Ida 2 s, pausa, regreso 1 s, pausa. Devuelve 0 (inicio) … 1 (fin). */
function phase(ms: number) {
  const t = ms % 3800;
  if (t < 400) return 0;
  if (t < 2400) return ease((t - 400) / 2000);
  if (t < 2700) return 1;
  return 1 - ease(Math.min(1, (t - 2700) / 1000));
}

function usePhase(animate: boolean) {
  const [t, setT] = React.useState(animate ? 0 : 1);
  React.useEffect(() => {
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return setT(1);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      setT(phase(now - t0));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animate]);
  return t;
}

export function ExerciseFigure({ name, animate = true, className }: { name: string; animate?: boolean; className?: string }) {
  const move = MOVES[name];
  const t = usePhase(animate && Boolean(move));
  if (!move) return null;
  const p = mix(move.a, move.b, t);
  const on = (part: Part) => move.works.includes(part);
  const seg = (a: P, b: P, part: Part | null, w = 7, back = false) => (
    <line
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke={part && on(part) ? 'var(--tint)' : 'currentColor'}
      strokeWidth={w}
      strokeLinecap="round"
      opacity={back ? 0.35 : 1}
    />
  );

  return (
    <svg viewBox="0 0 240 172" className={className} role="img" aria-label={`${name}: ${move.label}`}>
      <line x1="8" y1={FLOOR + 3} x2="232" y2={FLOOR + 3} stroke="var(--sep)" strokeWidth="2" strokeLinecap="round" />
      {move.props?.includes('chair') && <Chair x={62} />}
      {move.props?.includes('support') && <Chair x={150} />}
      {move.props?.includes('table') && (
        <g stroke="var(--ink-3)" strokeWidth="4" strokeLinecap="round" fill="none">
          <line x1="150" y1="120" x2="218" y2="120" strokeWidth="6" />
          <line x1="156" y1="123" x2="156" y2={FLOOR} />
          <line x1="212" y1="123" x2="212" y2={FLOOR} />
        </g>
      )}

      {/* Extremidades de atrás, tenues */}
      {seg(p.hip, p.knee2, 'thigh', 7, true)}
      {seg(p.knee2, p.ankle2, 'shin', 7, true)}
      {seg(p.ankle2, p.toe2, null, 5, true)}
      {seg(p.shoulder, p.elbow2, 'upperArm', 6, true)}
      {seg(p.elbow2, p.hand2, 'forearm', 6, true)}

      {/* Cuerpo */}
      {seg(p.shoulder, p.hip, 'torso', 10)}
      {on('glute') && <circle cx={p.hip[0]} cy={p.hip[1]} r="8" fill="var(--tint)" />}
      {seg(p.hip, p.knee, 'thigh', 8)}
      {seg(p.knee, p.ankle, 'shin', 7)}
      {seg(p.ankle, p.toe, null, 5)}
      {seg(p.shoulder, p.elbow, 'upperArm', 6)}
      {seg(p.elbow, p.hand, 'forearm', 6)}
      <circle cx={p.head[0]} cy={p.head[1]} r="10" fill="currentColor" />

      {move.props?.includes('backpack') && <rect x={p.hand[0] - 10} y={p.hand[1] - 2} width="20" height="22" rx="6" fill="var(--star)" />}
    </svg>
  );
}

/** Silla de lado con el respaldo a la izquierda. */
function Chair({ x }: { x: number }) {
  const seat = 128;
  return (
    <g stroke="var(--ink-3)" strokeWidth="4" strokeLinecap="round" fill="none">
      <line x1={x} y1={seat} x2={x + 38} y2={seat} strokeWidth="5" />
      <line x1={x + 2} y1={seat} x2={x + 2} y2={seat - 52} />
      <line x1={x + 2} y1={seat} x2={x + 2} y2={FLOOR} />
      <line x1={x + 36} y1={seat} x2={x + 36} y2={FLOOR} />
    </g>
  );
}
