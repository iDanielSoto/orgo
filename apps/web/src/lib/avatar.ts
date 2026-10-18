/** Recorta al centro en cuadrado, reduce a 512 px y comprime en JPEG por debajo de 280 KB. */
export async function imageToAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(512, side);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  for (let q = 0.88; q >= 0.5; q -= 0.08) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length * 0.75 < 280 * 1024) return url;
  }
  throw new Error('No se pudo reducir la imagen');
}
