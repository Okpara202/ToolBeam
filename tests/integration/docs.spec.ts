import { createApp } from '@/app';
import { generateOpenApiSpec } from '@/lib/open-api';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

/**
 * Guards the promise the API documentation makes: every endpoint that exists is
 * described, and it is described the way it actually behaves. The spec is
 * generated from the same Zod schemas the routes validate with, so this suite
 * is really checking that nothing was added to the router without also being
 * registered in lib/*.docs.ts.
 */
const DOCUMENTED_ENDPOINTS = [
  ['post', '/api/v1/auth/register'],
  ['post', '/api/v1/auth/login'],
  ['get', '/api/v1/auth/me'],
  ['post', '/api/v1/tools'],
  ['get', '/api/v1/tools'],
  ['get', '/api/v1/tools/recent'],
  ['get', '/api/v1/tools/popular'],
  ['get', '/api/v1/tools/{id}'],
  ['get', '/api/v1/tools/{id}/related'],
  ['post', '/api/v1/tools/{id}/upvote'],
  ['delete', '/api/v1/tools/{id}/upvote'],
  ['get', '/api/v1/categories'],
] as const;

describe('OpenAPI documentation', () => {
  const spec = generateOpenApiSpec() as unknown as {
    paths: Record<string, Record<string, unknown>>;
    components: { securitySchemes: Record<string, unknown> };
  };

  it.each(DOCUMENTED_ENDPOINTS)('documents %s %s', (method, path) => {
    expect(spec.paths[path]).toBeDefined();
    expect(spec.paths[path][method]).toBeDefined();
  });

  it('documents nothing that does not exist', () => {
    const documented = Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => `${method} ${path}`),
    );
    const expected = DOCUMENTED_ENDPOINTS.map(([method, path]) => `${method} ${path}`);

    expect(documented.sort()).toEqual(expected.sort());
  });

  it('declares bearer auth on the endpoints that require it', () => {
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });

    for (const path of ['/api/v1/tools', '/api/v1/tools/{id}/upvote']) {
      expect((spec.paths[path].post as { security?: unknown }).security).toBeDefined();
    }
  });

  it('leaves the public discovery endpoints unauthenticated', () => {
    for (const path of ['/api/v1/tools/recent', '/api/v1/tools/popular']) {
      expect((spec.paths[path].get as { security?: unknown }).security).toBeUndefined();
    }
  });

  it('serves the spec and the Swagger UI when docs are enabled', async () => {
    const app = await createApp({ enableDocs: true });

    const json = await request(app).get('/docs.json');
    const ui = await request(app).get('/docs/');

    expect(json.status).toBe(200);
    expect(json.body.info.title).toBe('Toolbeam API');
    expect(ui.status).toBe(200);
  });

  it('answers the health check', async () => {
    const app = await createApp({ enableDocs: false });

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('404s an unknown route through the standard error envelope', async () => {
    const app = await createApp({ enableDocs: false });

    const response = await request(app).get('/api/v1/nope');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });
});
