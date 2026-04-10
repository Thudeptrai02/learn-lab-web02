import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const exams = defineCollection({
  // Loader cực chuẩn cho Astro 5
  loader: glob({ pattern: "**/*.{md,mdx}", base: "src/content/exams" }),
  schema: z.object({
    title: z.string(),
    test_id: z.string(),
    exam: z.string(),
    parts: z.array(z.any()).default([]),
  }),
});

export const collections = { exams };