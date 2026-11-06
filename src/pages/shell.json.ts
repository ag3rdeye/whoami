import about from '@/data/about.json';
import site from '@/data/site.json';
import skills from '@/data/skills.json';
import {
  getCredentials,
  getExperience,
  getProjects,
  getResearch,
  getWriteups,
  period,
} from '@/lib/content';

type Entry = { text: string; url?: string };

// Mirrors published content only; the getters drop drafts and private entries in production.
export async function GET() {
  const files: Record<string, Entry> = {};
  const add = (path: string, text: string, url?: string) => (files[path] = { text, url });

  add('/about.txt', about.bio, '/about');
  add(
    '/contact.txt',
    [
      `email     ${site.email}`,
      `github    ${site.socials.github}`,
      `linkedin  ${site.socials.linkedin}`,
    ].join('\n'),
    '/contact'
  );

  const names = (group: string) =>
    skills.items.filter((i) => i.group === group).map((i) => i.name).join(', ');
  add('/skills.txt', `offensive\n  ${names('offensive')}\n\ndefensive\n  ${names('defensive')}`, '/about');

  for (const e of await getResearch()) {
    const d = e.data;
    add(
      `/research/${e.id}.txt`,
      [
        d.cve && `id        ${d.cve}`,
        d.product && `product   ${d.product}`,
        d.severity && `severity  ${d.severity}${d.cvss != null ? ` (CVSS ${d.cvss})` : ''}`,
        `status    ${d.disclosureStatus}`,
        '',
        d.summary,
      ]
        .filter((l) => typeof l === 'string')
        .join('\n'),
      `/research/${e.id}`
    );
  }
  for (const e of await getProjects()) {
    add(`/projects/${e.id}.txt`, `${e.data.name} [${e.data.projectStatus}]\n\n${e.data.description}`, `/projects/${e.id}`);
  }
  for (const e of await getWriteups()) {
    add(`/writeup/${e.id}.txt`, `${e.data.title}\n\n${e.data.description}`, `/writeup/${e.id}`);
  }
  for (const e of await getExperience()) {
    const d = e.data;
    add(
      `/experience/${e.id}.txt`,
      [`${d.position} at ${d.org}`, period(d.start, d.end, d.current), '', ...d.responsibilities.map((r) => `- ${r}`)].join('\n'),
      '/experience'
    );
  }
  const { certifications, recognition } = await getCredentials();
  const line = (c: (typeof certifications)[number]) =>
    `- ${c.data.name}${c.data.issuer ? ` (${c.data.issuer})` : ''}`;
  add('/certifications.txt', certifications.map(line).join('\n'), '/about');
  add('/recognition.txt', recognition.map(line).join('\n'), '/about');

  return new Response(JSON.stringify({ files }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
