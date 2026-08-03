import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth-server';
import { mutateConfig } from '@/lib/config-store';
import { revalidateHome } from '@/lib/revalidate';
import { categorySchema } from '@/lib/schema';

// PUT /api/admin/categories — replace the whole category list (create/rename/
// recolor/reorder/delete in one request). Deleting a category that still has
// links is rejected with 409 so links can never point at a missing category.
const bodySchema = z.object({ categories: z.array(categorySchema).min(1) });

// Thrown from inside the mutateConfig mutator so the in-use check runs against
// the same snapshot that gets written (no separate read → no gap for a
// concurrently created link to slip into a just-deleted category).
class CategoryInUseError extends Error {
  constructor(
    public categoryId: string,
    public count: number
  ) {
    super('category_in_use');
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'invalid_categories', issues: parsed.error.issues });
  }

  // Order is the submitted position, normalized server-side.
  const next = parsed.data.categories.map((c, i) => ({ ...c, order: i + 1 }));
  const ids = new Set(next.map((c) => c.id));
  if (ids.size !== next.length) {
    return res.status(400).json({ error: 'duplicate_id' });
  }

  let saved;
  try {
    saved = await mutateConfig((draft) => {
      for (const cat of draft.categories) {
        if (!ids.has(cat.id)) {
          const count = draft.links.filter(
            (l) => l.categoryId === cat.id
          ).length;
          if (count > 0) throw new CategoryInUseError(cat.id, count);
        }
      }
      draft.categories = next;
    }, admin.email ?? admin.userId);
  } catch (err) {
    if (err instanceof CategoryInUseError) {
      return res.status(409).json({
        error: 'category_in_use',
        categoryId: err.categoryId,
        count: err.count,
      });
    }
    throw err;
  }

  await revalidateHome(res);
  return res.status(200).json(saved.categories);
}
