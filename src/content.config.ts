import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const md = (dir: string) => glob({ pattern: '**/*.{md,mdx}', base: `./src/content/${dir}` });

// The CMS can save an empty optional field as '' or null; treat both as unset.
const blank = (v: unknown) => (v === '' || v === null ? undefined : v);
const optText = z.preprocess(blank, z.string().optional());
const optUrl = z.preprocess(blank, z.url().optional());
const optDate = z.preprocess(blank, z.coerce.date().optional());
// CMS uploads land in public/images and are stored as /images/... paths.
const optImage = optText;
// Dropdowns, switches, and numbers the CMS leaves unset fall back to their defaults.
const choice = <T extends z.ZodType>(schema: T) => z.preprocess(blank, schema);
const flag = choice(z.boolean().default(false));
const order = choice(z.number().default(0));
const link = z.object({ label: z.string(), url: z.url() });
const list = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => v ?? [], z.array(item));

// Vulnerability research / CVE archive
const research = defineCollection({
  loader: md('research'),
  schema: z.object({
    title: z.string(),
    cve: optText,
    classification: optText,
    product: optText,
    severity: z.preprocess(
      blank,
      z.enum(['informational', 'low', 'medium', 'high', 'critical']).optional()
    ),
    cvss: z.preprocess(blank, z.number().min(0).max(10).optional()),
    cvssVector: optText,
    publishDate: optDate,
    discoveryDate: optDate,
    disclosureStatus: choice(
      z
        .enum(['reported', 'acknowledged', 'patched', 'public', 'embargoed', 'reserved'])
        .default('reported')
    ),
    status: choice(z.enum(['draft', 'published', 'private']).default('draft')),
    summary: z.string(),
    featured: flag,
    featuredImage: optImage,
    references: list(link),
    advisories: list(link),
    related: list(z.string()),
  }),
});

// Project portfolio
const projects = defineCollection({
  loader: md('projects'),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    category: choice(
      z
        .enum(['Security Tools', 'Automation', 'Open Source', 'Research', 'Personal Experiments'])
        .default('Security Tools')
    ),
    projectStatus: choice(
      z.enum(['active', 'in-progress', 'completed', 'archived', 'planned']).default('in-progress')
    ),
    tech: list(z.string()),
    features: list(z.string()),
    repo: optUrl,
    demo: optUrl,
    startDate: optDate,
    updated: optDate,
    featured: flag,
    status: choice(z.enum(['draft', 'published']).default('draft')),
    screenshots: list(z.object({ src: z.string(), alt: z.string() })),
    featuredImage: optImage,
  }),
});

// Technical articles / writeups
const writeup = defineCollection({
  loader: md('writeup'),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    updated: optDate,
    category: choice(z.string().default('Learning Notes')),
    tags: list(z.string()),
    author: choice(z.string().default('Arjun Giri')),
    cover: optImage,
    draft: choice(z.boolean().default(true)),
    featured: flag,
    related: list(z.string()),
    references: list(link),
  }),
});

// Professional experience
const experience = defineCollection({
  loader: md('experience'),
  schema: z.object({
    org: z.string(),
    position: z.string(),
    start: optText,
    end: optText,
    current: flag,
    location: optText,
    description: optText,
    responsibilities: list(z.string()),
    achievements: list(z.string()),
    tech: list(z.string()),
    logo: optImage,
    order,
  }),
});

// Certifications, awards, recognition
const certifications = defineCollection({
  loader: md('certifications'),
  schema: z.object({
    name: z.string(),
    short: optText,
    issuer: optText,
    issueDate: optText,
    credentialId: optText,
    verifyUrl: optUrl,
    logo: optImage,
    image: optImage,
    description: optText,
    category: choice(z.enum(['Certification', 'Award', 'Acknowledgement']).default('Certification')),
    order,
  }),
});

export const collections = { research, projects, writeup, experience, certifications };
