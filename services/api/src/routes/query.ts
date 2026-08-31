import { z } from "zod";

export const pageQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const identifier = z.string().min(1).max(160);

export function pageResponse<T>(items: T[], nextCursor: string | null): {
  items: T[];
  page: { next_cursor: string | null };
} {
  return { items, page: { next_cursor: nextCursor } };
}
