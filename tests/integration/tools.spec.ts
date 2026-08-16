import { Category } from '@/constants/category';
import { API, buildApp, registerUser, seedTool, submitTool, toolPayload, type App } from '../helpers';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('Tools', () => {
  let app: App;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    ({ token } = await registerUser(app));
  });

  describe('submitting', () => {
    it('requires authentication', async () => {
      const response = await request(app).post(`${API}/tools`).send(toolPayload());

      expect(response.status).toBe(401);
    });

    it('accepts a valid submission and returns the stored tool', async () => {
      const response = await submitTool(app, token, {
        name: 'Perplexity',
        category: Category.RESEARCH,
        tags: ['Search', 'Citations'],
      });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        name: 'Perplexity',
        category: Category.RESEARCH,
        upvoteCount: 0,
      });
      expect(response.body.data.id).toEqual(expect.any(String));
      // Tags are normalized to lowercase on write.
      expect(response.body.data.tags).toEqual(['search', 'citations']);
      // Internal ranking machinery stays internal.
      expect(response.body.data).not.toHaveProperty('keywords');
      expect(response.body.data).not.toHaveProperty('linkKey');
    });

    it('rejects an invalid payload with field-level messages', async () => {
      const response = await request(app)
        .post(`${API}/tools`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X', description: 'too short', category: 'not-a-category', link: 'nope' });

      expect(response.status).toBe(422);
      expect(Object.keys(response.body.errors)).toEqual(
        expect.arrayContaining(['name', 'description', 'category', 'link']),
      );
    });

    it('rejects a duplicate link regardless of protocol, www or trailing slash', async () => {
      await submitTool(app, token, { link: 'https://www.duplicate-check.com/' });

      const response = await submitTool(app, token, { link: 'http://duplicate-check.com' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('TOOL_ALREADY_EXISTS');
    });
  });

  describe('GET /tools/recent', () => {
    it('places a newly submitted tool at the top', async () => {
      await seedTool({ name: 'Older Tool A', ageDays: 10 });
      await seedTool({ name: 'Older Tool B', ageDays: 3 });

      const submitted = await submitTool(app, token, { name: 'Brand New Tool' });
      expect(submitted.status).toBe(201);

      const response = await request(app).get(`${API}/tools/recent`);

      expect(response.status).toBe(200);
      expect(response.body.data[0].name).toBe('Brand New Tool');
      expect(response.body.data[0].id).toBe(submitted.body.data.id);
    });

    it('orders strictly by createdAt, newest first', async () => {
      await seedTool({ name: 'Three Days Old', ageDays: 3 });
      await seedTool({ name: 'Ten Days Old', ageDays: 10 });
      await seedTool({ name: 'One Day Old', ageDays: 1 });

      const response = await request(app).get(`${API}/tools/recent`);

      expect(response.body.data.map((tool: { name: string }) => tool.name)).toEqual([
        'One Day Old',
        'Three Days Old',
        'Ten Days Old',
      ]);
    });

    it('resolves as a literal path, not as /tools/:id', async () => {
      // Regression guard. If /:id is ever declared above /recent in
      // tool.routes.ts, Express matches "recent" as an id and this returns 400.
      await seedTool({ name: 'Anything' });

      const recent = await request(app).get(`${API}/tools/recent`);
      const popular = await request(app).get(`${API}/tools/popular`);

      expect(recent.status).toBe(200);
      expect(popular.status).toBe(200);
    });

    it('paginates', async () => {
      await seedTool({ name: 'Page Tool 1', ageDays: 3 });
      await seedTool({ name: 'Page Tool 2', ageDays: 2 });
      await seedTool({ name: 'Page Tool 3', ageDays: 1 });

      const response = await request(app).get(`${API}/tools/recent?limit=2&page=2`);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    });
  });

  describe('GET /tools', () => {
    it('filters by category', async () => {
      await seedTool({ name: 'A Coding Tool', category: Category.CODE_ASSISTANT });
      await seedTool({ name: 'A Design Tool', category: Category.DESIGN });

      const response = await request(app).get(`${API}/tools?category=${Category.DESIGN}`);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('A Design Tool');
    });

    it('searches across name, description and tags', async () => {
      await seedTool({ name: 'Findable', tags: ['unicorn'] });
      await seedTool({ name: 'Unrelated' });

      const response = await request(app).get(`${API}/tools?search=unicorn`);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Findable');
    });

    it('does not break on regex metacharacters in the search term', async () => {
      await seedTool({ name: 'Regex Safe' });

      const response = await request(app).get(`${API}/tools?search=${encodeURIComponent('c++ (')}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /tools/:id', () => {
    it('returns a single tool', async () => {
      const tool = await seedTool({ name: 'Single' });

      const response = await request(app).get(`${API}/tools/${tool._id.toString()}`);

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Single');
    });

    it('400s on a malformed id and 404s on an unknown one', async () => {
      const malformed = await request(app).get(`${API}/tools/not-an-object-id`);
      const unknown = await request(app).get(`${API}/tools/6a60b8659c16fbcbeab13e49`);

      expect(malformed.status).toBe(400);
      expect(malformed.body.error.code).toBe('INVALID_ID');
      expect(unknown.status).toBe(404);
      expect(unknown.body.error.code).toBe('TOOL_NOT_FOUND');
    });
  });
});
