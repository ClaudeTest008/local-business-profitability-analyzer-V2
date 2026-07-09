import type { FastifyInstance } from 'fastify';
import { getBusinessType, taxonomy } from '@lboa/taxonomy';

const slimTypes = taxonomy.businessTypes.map((bt) => ({
  id: bt.id,
  name: bt.name,
  categoryId: bt.categoryId,
  subcategoryId: bt.subcategoryId,
  description: bt.description,
}));

export function taxonomyRoutes() {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get('/taxonomy', () => ({
      version: taxonomy.version,
      categories: taxonomy.categories,
      subcategories: taxonomy.subcategories,
      businessTypes: slimTypes,
    }));

    app.get<{ Params: { id: string } }>('/taxonomy/types/:id', (req, reply) => {
      const profile = getBusinessType(req.params.id);
      if (!profile) return reply.status(404).send({ error: 'not_found' });
      return profile;
    });
  };
}
