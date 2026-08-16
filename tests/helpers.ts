import { createApp } from '@/app';
import { Category } from '@/constants/category';
import Tool from '@/db/models/tool.model';
import Upvote from '@/db/models/upvote.model';
import { extractKeywords, normalizeLink, normalizeTags } from '@/utils/helper.util';
import { Types } from 'mongoose';
import request from 'supertest';

export const API = '/api/v1';
const MS_PER_DAY = 86_400_000;

export const buildApp = () => createApp({ enableDocs: false });

export type App = Awaited<ReturnType<typeof buildApp>>;

let sequence = 0;
const unique = () => `${Date.now().toString(36)}${(sequence += 1)}`;

export const registerUser = async (app: App, overrides: Record<string, unknown> = {}) => {
  const payload = {
    name: 'Test User',
    email: `user-${unique()}@toolbeam.dev`,
    password: 'Toolbeam123!',
    ...overrides,
  };

  const response = await request(app).post(`${API}/auth/register`).send(payload);

  return {
    payload,
    response,
    token: response.body?.data?.token as string,
    id: response.body?.data?.user?.id as string,
  };
};

export const toolPayload = (overrides: Record<string, unknown> = {}) => ({
  name: `Test Tool ${unique()}`,
  description: 'A generated tool used by the integration suite to exercise the submission path.',
  category: Category.PRODUCTIVITY,
  link: `https://example.com/${unique()}`,
  tags: ['testing'],
  ...overrides,
});

export const submitTool = async (
  app: App,
  token: string,
  overrides: Record<string, unknown> = {},
) => request(app).post(`${API}/tools`).set('Authorization', `Bearer ${token}`).send(toolPayload(overrides));

interface SeedToolOptions {
  name: string;
  category?: Category;
  tags?: string[];
  description?: string;
  /** How long ago the tool was created — drives the age term in the decay. */
  ageDays?: number;
  /** Written straight to the denormalized counter. Use castUpvotes for real documents. */
  upvoteCount?: number;
}

/**
 * Inserts a tool directly, bypassing the API, so a spec can control `createdAt`
 * and the counter — neither of which the submit endpoint lets a client set.
 *
 * Keywords are derived with the same helper the service uses, so a seeded tool
 * and a submitted one score identically in the related pipeline.
 */
export const seedTool = async ({
  name,
  category = Category.PRODUCTIVITY,
  tags = [],
  description = `${name} is a seeded fixture used by the integration suite for ranking assertions.`,
  ageDays = 0,
  upvoteCount = 0,
}: SeedToolOptions) => {
  const createdAt = new Date(Date.now() - ageDays * MS_PER_DAY);
  const link = `https://example.com/${name.toLowerCase().replace(/\s+/g, '-')}`;

  const [tool] = await Tool.insertMany(
    [
      {
        name,
        description,
        category,
        link,
        linkKey: normalizeLink(link),
        tags: normalizeTags(tags),
        keywords: extractKeywords(name, description),
        submittedBy: new Types.ObjectId(),
        upvoteCount,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    // Keeps the backdated createdAt instead of letting mongoose stamp "now".
    { timestamps: false },
  );

  return tool;
};

/**
 * Creates real Upvote documents at a chosen time, for testing the windowed
 * trending pipeline. Each gets a distinct synthetic user id so the unique
 * { user, tool } index is satisfied.
 */
export const castUpvotes = async (toolId: Types.ObjectId, count: number, daysAgo = 0) => {
  const at = new Date(Date.now() - daysAgo * MS_PER_DAY);

  await Upvote.insertMany(
    Array.from({ length: count }, () => ({
      user: new Types.ObjectId(),
      tool: toolId,
      createdAt: at,
      updatedAt: at,
    })),
    { timestamps: false },
  );

  await Tool.findByIdAndUpdate(toolId, { $inc: { upvoteCount: count } });
};

export const names = (tools: { name: string }[]) => tools.map((tool) => tool.name);
