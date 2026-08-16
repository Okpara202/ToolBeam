import { API, buildApp, castUpvotes, seedTool, type App } from '../helpers';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

interface PopularItem {
  id: string;
  name: string;
  upvoteCount: number;
  popularityScore: number;
  ageHours?: number;
  windowUpvotes?: number;
}

const popular = (app: App, query = '') => request(app).get(`${API}/tools/popular${query}`);

describe('Popular tools', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it('ranks recent momentum above a larger but older total', async () => {
    // This is the design in one assertion. A raw upvote sort puts the veteran
    // first by more than 13x; the age discount puts the newcomer first instead.
    await seedTool({ name: 'Veteran', ageDays: 400, upvoteCount: 800 });
    await seedTool({ name: 'Newcomer', ageDays: 3, upvoteCount: 60 });

    const response = await popular(app);
    const results = response.body.data as PopularItem[];

    expect(response.status).toBe(200);
    expect(results[0].name).toBe('Newcomer');
    expect(results[1].name).toBe('Veteran');
    expect(results[0].upvoteCount).toBeLessThan(results[1].upvoteCount);
    expect(results[0].popularityScore).toBeGreaterThan(results[1].popularityScore);
  });

  it('still rewards a genuinely larger total at equal age', async () => {
    // The decay must not be so aggressive that upvotes stop mattering.
    await seedTool({ name: 'Fewer Votes', ageDays: 30, upvoteCount: 20 });
    await seedTool({ name: 'More Votes', ageDays: 30, upvoteCount: 200 });

    const results = (await popular(app)).body.data as PopularItem[];

    expect(results[0].name).toBe('More Votes');
  });

  it('sinks tools with no upvotes to the bottom', async () => {
    await seedTool({ name: 'Never Upvoted', ageDays: 0, upvoteCount: 0 });
    await seedTool({ name: 'Has Upvotes', ageDays: 200, upvoteCount: 5 });

    const results = (await popular(app)).body.data as PopularItem[];

    // A brand-new tool with zero upvotes must not lead /popular on recency
    // alone — that is what /recent is for.
    expect(results[0].name).toBe('Has Upvotes');
    expect(results.at(-1)).toMatchObject({ name: 'Never Upvoted', popularityScore: 0 });
  });

  it('returns scores in descending order and exposes the working', async () => {
    await seedTool({ name: 'One', ageDays: 10, upvoteCount: 50 });
    await seedTool({ name: 'Two', ageDays: 40, upvoteCount: 90 });
    await seedTool({ name: 'Three', ageDays: 120, upvoteCount: 300 });

    const results = (await popular(app)).body.data as PopularItem[];
    const scores = results.map((tool) => tool.popularityScore);

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    // The score and the age it was computed from are both in the response, so
    // the ordering can be checked by hand.
    expect(results[0].ageHours).toEqual(expect.any(Number));
  });

  it('respects the limit', async () => {
    await seedTool({ name: 'A', upvoteCount: 5 });
    await seedTool({ name: 'B', upvoteCount: 4 });
    await seedTool({ name: 'C', upvoteCount: 3 });

    const results = (await popular(app, '?limit=2')).body.data as PopularItem[];

    expect(results).toHaveLength(2);
  });

  describe('?window', () => {
    it('counts only upvotes cast inside the window', async () => {
      const steady = await seedTool({ name: 'Steady', ageDays: 200 });
      const surging = await seedTool({ name: 'Surging', ageDays: 200 });

      // Big lifetime total, but all of it is months old.
      await castUpvotes(steady._id, 100, 100);
      // Far fewer votes, all of them this week.
      await castUpvotes(surging._id, 20, 1);

      const response = await popular(app, '?window=week');
      const results = response.body.data as PopularItem[];

      expect(response.body.window).toBe('week');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ name: 'Surging', windowUpvotes: 20 });
    });

    it('widens correctly for a month', async () => {
      const tool = await seedTool({ name: 'Last Fortnight', ageDays: 200 });
      await castUpvotes(tool._id, 12, 14);

      const week = (await popular(app, '?window=week')).body.data as PopularItem[];
      const month = (await popular(app, '?window=month')).body.data as PopularItem[];

      expect(week).toHaveLength(0);
      expect(month).toHaveLength(1);
      expect(month[0].windowUpvotes).toBe(12);
    });

    it('rejects an unknown window', async () => {
      const response = await popular(app, '?window=decade');

      expect(response.status).toBe(422);
      expect(response.body.errors).toHaveProperty('window');
    });
  });
});
