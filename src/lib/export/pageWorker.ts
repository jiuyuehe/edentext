// Encodes one page bitmap to JPEG off the main thread, on a white ground.
self.onmessage = async (e: MessageEvent<{ id: number; bitmap: ImageBitmap }>) => {
  const { id, bitmap } = e.data;
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
  self.postMessage({ id, blob });
};
