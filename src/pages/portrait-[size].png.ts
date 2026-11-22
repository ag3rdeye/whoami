import type { APIRoute } from 'astro';
import { portraitColors, SIZES, type Size } from '@/lib/portrait';

export const getStaticPaths = () => Object.keys(SIZES).map((size) => ({ params: { size } }));

export const GET: APIRoute = async ({ params }) => {
  const png = await portraitColors(params.size as Size);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
