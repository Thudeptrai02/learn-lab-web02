import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date().optional(),
    description: z.string().optional(),
  }),
});

const courses = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    type: z.enum(['flashcard', 'dictation']),
    exam: z.enum(['TOEIC', 'IELTS', 'Cambridge']),
  }),
});

const resources = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    url: z.string(),
    type: z.enum(['PDF', 'Worksheet', 'Checklist']),
  }),
});

export const collections = { blog, courses, resources };
