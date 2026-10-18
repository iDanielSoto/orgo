import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { server: 'src/server.ts', vercel: 'src/vercel.ts', seed: 'prisma/seed.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // El paquete compartido se distribuye como TypeScript: se incluye en el bundle.
  noExternal: ['@forma/core'],
});
