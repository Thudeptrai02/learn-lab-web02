import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders'; // Loader bắt buộc cho Astro 6

const blog = defineCollection({
  // Chỉ định rõ chỗ chứa bài viết cho "xe tải" glob đi bốc hàng
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    pubDate: z.coerce.date().optional(), // Ép kiểu ngày tháng để không lỗi
    image: z.string().optional(),
  })
});

export const collections = { blog };