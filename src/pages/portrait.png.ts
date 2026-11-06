import { portraitColors } from '@/lib/portrait';

export async function GET() {
  const png = await portraitColors();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
}
