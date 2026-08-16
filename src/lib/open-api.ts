import { API_BASE_URL } from '@/config/env.config';
import { registerAuthDocs } from '@/lib/auth.docs';
import { registry } from '@/lib/open-api-registry';
import { registerToolDocs } from '@/lib/tool.docs';
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

let initialized = false;

const ensureDocsRegistered = () => {
  if (initialized) return;

  registerAuthDocs();
  registerToolDocs();

  initialized = true;
};

export const generateOpenApiSpec = () => {
  ensureDocsRegistered();

  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Toolbeam API',
      version: '1.0.0',
      description: [
        '**Toolbeam** is the backend for an AI tools directory — a beacon through the noise of',
        'thousands of AI launches a month.',
        '',
        'Anyone can browse. Registered users submit tools and upvote them. Discovery happens three ways:',
        '',
        '| Endpoint | Ranked by |',
        '| --- | --- |',
        '| `GET /tools/recent` | `createdAt`, newest first |',
        '| `GET /tools/popular` | upvotes discounted by age, computed at read time |',
        '| `GET /tools/:id/related` | weighted overlap of category, tags and derived keywords |',
        '',
        '### Getting a token',
        '',
        '`POST /auth/register` or `POST /auth/login` returns `data.token`. Paste it into **Authorize**',
        'above, then the padlocked endpoints will work.',
      ].join('\n'),
      contact: { name: 'Toolbeam' },
      license: { name: 'MIT' },
    },
    servers: [{ url: API_BASE_URL, description: 'Current environment' }],
    tags: [
      { name: 'Auth', description: 'Registration, login and the current user' },
      { name: 'Tools', description: 'Submitting, browsing and upvoting tools' },
      {
        name: 'Discovery',
        description: 'The three ranked views: recent, popular and related',
      },
    ],
  });
};
