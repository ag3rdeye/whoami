import { getCollection, type CollectionEntry } from 'astro:content';

// Hide drafts/private entries in production; show everything in dev.
const live = import.meta.env.PROD;

export async function getResearch() {
  const all = await getCollection('research');
  const items = live ? all.filter((e) => e.data.status === 'published') : all;
  return items.sort(
    (a, b) => (b.data.publishDate?.valueOf() ?? 0) - (a.data.publishDate?.valueOf() ?? 0)
  );
}

export async function getProjects() {
  const all = await getCollection('projects');
  const items = live ? all.filter((e) => e.data.status === 'published') : all;
  return items.sort(
    (a, b) => (b.data.updated?.valueOf() ?? 0) - (a.data.updated?.valueOf() ?? 0)
  );
}

export async function getWriteups() {
  const all = await getCollection('writeup');
  const items = live ? all.filter((e) => !e.data.draft) : all;
  return items.sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());
}

export async function getExperience() {
  const all = await getCollection('experience');
  return all.sort((a, b) => a.data.order - b.data.order);
}

export async function getCertifications() {
  const all = await getCollection('certifications');
  return all.sort((a, b) => a.data.order - b.data.order);
}

// Awards and acknowledgements are recognition, not certifications.
export async function getCredentials() {
  const all = await getCertifications();
  return {
    certifications: all.filter((e) => e.data.category === 'Certification'),
    recognition: all.filter((e) => e.data.category !== 'Certification'),
  };
}

export const period = (start?: string, end?: string, current = false) =>
  [start, current ? 'Present' : end].filter(Boolean).join(' to ');

// Rough reading time from rendered markdown body.
export function readingTime(body: string | undefined): number {
  const words = (body ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export type Research = CollectionEntry<'research'>;
export type Project = CollectionEntry<'projects'>;
export type Writeup = CollectionEntry<'writeup'>;
export type Experience = CollectionEntry<'experience'>;
export type Certification = CollectionEntry<'certifications'>;
