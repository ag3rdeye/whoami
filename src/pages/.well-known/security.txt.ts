import site from '@/data/site.json';

// RFC 9116. Expires rolls forward on every build.
export function GET() {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const body = [
    `Contact: mailto:${site.email}`,
    `Expires: ${expires}`,
    'Preferred-Languages: en',
    `Canonical: https://${site.domain}/.well-known/security.txt`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
