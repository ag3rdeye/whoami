import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getWriteups } from '@/lib/content';
import site from '@/data/site.json';

export async function GET(context: APIContext) {
  const items = await getWriteups();
  return rss({
    title: `${site.title} | Writeups`,
    description: site.description,
    site: context.site ?? `https://${site.domain}`,
    items: items.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.publishDate,
      link: `/writeup/${entry.id}/`,
      categories: entry.data.tags,
    })),
  });
}
