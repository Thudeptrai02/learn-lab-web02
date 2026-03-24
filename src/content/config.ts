import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    description: z.string(),  // ← THÊM DÒNG NÀY
  })
});

export const collections = {
  'blog': blog,
  // ...collections khác
};
