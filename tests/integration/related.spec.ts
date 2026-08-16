import { Category } from '@/constants/category';
import { API, buildApp, registerUser, seedTool, submitTool, type App } from '../helpers';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

interface RelatedItem {
  id: string;
  name: string;
  relevanceScore: number;
  matchedOn: { sameCategory: boolean; sharedTags: string[]; sharedKeywords: string[] };
}

const related = (app: App, id: string, limit = 2) =>
  request(app).get(`${API}/tools/${id}/related?limit=${limit}`);

/**
 * Two clusters with different categories, disjoint tags and non-overlapping
 * description vocabulary — so any similarity the pipeline reports between
 * clusters would have to be a real bug rather than shared fixture wording.
 */
const seedTwoClusters = async () => {
  const midjourney = await seedTool({
    name: 'Midjourney',
    category: Category.IMAGE_GENERATION,
    tags: ['image', 'art', 'diffusion'],
    description: 'Renders stylised artwork from prompts for concept illustration boards.',
  });
  await seedTool({
    name: 'Stable Diffusion',
    category: Category.IMAGE_GENERATION,
    tags: ['image', 'art', 'diffusion'],
    description: 'Open weights model rendering stylised artwork illustration from prompts.',
  });
  await seedTool({
    name: 'Ideogram',
    category: Category.IMAGE_GENERATION,
    tags: ['image', 'typography'],
    description: 'Renders legible lettering inside generated artwork posters.',
  });

  const copilot = await seedTool({
    name: 'GitHub Copilot',
    category: Category.CODE_ASSISTANT,
    tags: ['coding', 'ide', 'autocomplete'],
    description: 'Suggests functions inline while developers type inside the editor.',
  });
  await seedTool({
    name: 'Cursor',
    category: Category.CODE_ASSISTANT,
    tags: ['coding', 'ide', 'autocomplete'],
    description: 'Editor suggesting multi file changes while developers type repository wide.',
  });
  await seedTool({
    name: 'Tabnine',
    category: Category.CODE_ASSISTANT,
    tags: ['coding', 'privacy'],
    description: 'Private completion running inside a company network for developers.',
  });

  return { midjourney, copilot };
};

describe('Related tools', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it('returns different results for two different tools', async () => {
    const { midjourney, copilot } = await seedTwoClusters();

    const forImage = await related(app, midjourney._id.toString());
    const forCode = await related(app, copilot._id.toString());

    expect(forImage.status).toBe(200);
    expect(forCode.status).toBe(200);

    const imageNames = forImage.body.data.map((tool: RelatedItem) => tool.name).sort();
    const codeNames = forCode.body.data.map((tool: RelatedItem) => tool.name).sort();

    expect(imageNames).toEqual(['Ideogram', 'Stable Diffusion']);
    expect(codeNames).toEqual(['Cursor', 'Tabnine']);
    // The two result sets share nothing at all.
    expect(imageNames.filter((name: string) => codeNames.includes(name))).toEqual([]);
  });

  it('echoes the source tool the results were matched against', async () => {
    const { midjourney } = await seedTwoClusters();

    const response = await related(app, midjourney._id.toString());

    expect(response.body.source).toMatchObject({
      id: midjourney._id.toString(),
      name: 'Midjourney',
      category: Category.IMAGE_GENERATION,
    });
  });

  it('ranks a stronger overlap above a weaker one', async () => {
    const { midjourney } = await seedTwoClusters();

    const response = await related(app, midjourney._id.toString());
    const [first, second] = response.body.data as RelatedItem[];

    // Stable Diffusion shares all three tags; Ideogram shares only "image".
    expect(first.name).toBe('Stable Diffusion');
    expect(second.name).toBe('Ideogram');
    expect(first.relevanceScore).toBeGreaterThan(second.relevanceScore);
  });

  it('explains why each result matched', async () => {
    const { midjourney } = await seedTwoClusters();

    const response = await related(app, midjourney._id.toString());
    const [first] = response.body.data as RelatedItem[];

    expect(first.matchedOn.sameCategory).toBe(true);
    expect(first.matchedOn.sharedTags.sort()).toEqual(['art', 'diffusion', 'image']);
  });

  it('never includes the source tool in its own results', async () => {
    const { midjourney } = await seedTwoClusters();

    const response = await related(app, midjourney._id.toString(), 10);
    const ids = response.body.data.map((tool: RelatedItem) => tool.id);

    expect(ids).not.toContain(midjourney._id.toString());
  });

  it('works for a tool submitted seconds ago with zero upvotes', async () => {
    await seedTwoClusters();
    const { token } = await registerUser(app);

    const submitted = await submitTool(app, token, {
      name: 'Toolbeam Scout',
      category: Category.IMAGE_GENERATION,
      tags: ['image', 'art'],
      description: 'Generates stylised artwork illustration boards from a written prompt.',
    });
    expect(submitted.body.data.upvoteCount).toBe(0);

    const response = await related(app, submitted.body.data.id);
    const results = response.body.data as RelatedItem[];

    expect(response.status).toBe(200);
    expect(results.length).toBeGreaterThan(0);
    // Behavioural signal is unavailable for a brand-new tool, so relatedness
    // has to come entirely from its content — and it does.
    expect(results.every((tool) => tool.matchedOn.sameCategory)).toBe(true);
    expect(results[0].relevanceScore).toBeGreaterThan(0);
  });

  it('backfills with popular tools rather than returning an empty list', async () => {
    await seedTwoClusters();

    // Nothing in this tool's category, no shared tags, and description
    // vocabulary that appears nowhere else — so nothing genuinely matches.
    const lonely = await seedTool({
      name: 'Zzyzx Ledger',
      category: Category.CUSTOMER_SUPPORT,
      tags: ['bookkeeping'],
      description: 'Reconciles ledger entries across quantum accounting records for auditors.',
    });

    const response = await related(app, lonely._id.toString(), 3);
    const results = response.body.data as RelatedItem[];

    expect(response.status).toBe(200);
    expect(results).toHaveLength(3);
    // Scored zero and matched on nothing — the response saying plainly that
    // these are a fallback, not a real match.
    expect(results.every((tool) => tool.relevanceScore === 0)).toBe(true);
    expect(results.every((tool) => tool.matchedOn.sameCategory === false)).toBe(true);
    expect(results.every((tool) => tool.matchedOn.sharedTags.length === 0)).toBe(true);
    expect(results.map((tool) => tool.id)).not.toContain(lonely._id.toString());
  });

  it('400s on a malformed id and 404s on an unknown one', async () => {
    const malformed = await related(app, 'not-an-id');
    const unknown = await related(app, '6a60b8659c16fbcbeab13e49');

    expect(malformed.status).toBe(400);
    expect(unknown.status).toBe(404);
  });
});
