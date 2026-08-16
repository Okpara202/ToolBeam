import Tool from '@/db/models/tool.model';
import Upvote from '@/db/models/upvote.model';
import { reconcileUpvoteCounts } from '@/services/upvote.service';
import { API, buildApp, registerUser, seedTool, type App } from '../helpers';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

describe('Upvotes', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  const upvote = (token: string, toolId: string) =>
    request(app).post(`${API}/tools/${toolId}/upvote`).set('Authorization', `Bearer ${token}`);

  const unUpvote = (token: string, toolId: string) =>
    request(app).delete(`${API}/tools/${toolId}/upvote`).set('Authorization', `Bearer ${token}`);

  it('requires authentication', async () => {
    const tool = await seedTool({ name: 'Guarded' });

    const response = await request(app).post(`${API}/tools/${tool._id.toString()}/upvote`);

    expect(response.status).toBe(401);
  });

  it('records an upvote and increments the counter', async () => {
    const { token } = await registerUser(app);
    const tool = await seedTool({ name: 'Upvotable' });

    const response = await upvote(token, tool._id.toString());

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ upvoteCount: 1, hasUpvoted: true });

    const stored = await Tool.findById(tool._id);
    expect(stored?.upvoteCount).toBe(1);
  });

  it('keeps the denormalized counter in step with the upvotes collection', async () => {
    const tool = await seedTool({ name: 'Consistent' });

    for (let i = 0; i < 3; i += 1) {
      const { token } = await registerUser(app);
      await upvote(token, tool._id.toString());
    }

    const [stored, documents] = await Promise.all([
      Tool.findById(tool._id),
      Upvote.countDocuments({ tool: tool._id }),
    ]);

    // The counter is a cache of this count. If these ever diverge, the cache is
    // wrong and `npm run reconcile` is what repairs it.
    expect(stored?.upvoteCount).toBe(3);
    expect(documents).toBe(3);
  });

  it('rejects a second upvote from the same user', async () => {
    const { token } = await registerUser(app);
    const tool = await seedTool({ name: 'Once Only' });

    const first = await upvote(token, tool._id.toString());
    const second = await upvote(token, tool._id.toString());

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_UPVOTED');

    // The rejected attempt must not have moved the counter.
    const stored = await Tool.findById(tool._id);
    expect(stored?.upvoteCount).toBe(1);
  });

  it('holds one-vote-per-user under concurrent requests', async () => {
    const { token } = await registerUser(app);
    const tool = await seedTool({ name: 'Race Target' });

    // A read-then-write check in application code would let several of these
    // through. The unique { user, tool } index is what actually stops them.
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => upvote(token, tool._id.toString())),
    );

    expect(responses.filter((res) => res.status === 200)).toHaveLength(1);
    expect(responses.filter((res) => res.status === 409)).toHaveLength(4);
    expect(await Upvote.countDocuments({ tool: tool._id })).toBe(1);
  });

  it('removes an upvote and decrements the counter', async () => {
    const { token } = await registerUser(app);
    const tool = await seedTool({ name: 'Reversible' });

    await upvote(token, tool._id.toString());
    const response = await unUpvote(token, tool._id.toString());

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ upvoteCount: 0, hasUpvoted: false });
    expect(await Upvote.countDocuments({ tool: tool._id })).toBe(0);
  });

  it('rejects removing an upvote that was never cast', async () => {
    const { token } = await registerUser(app);
    const tool = await seedTool({ name: 'Never Voted' });

    const response = await unUpvote(token, tool._id.toString());

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('NOT_UPVOTED');
  });

  it('404s for a tool that does not exist and 400s for a malformed id', async () => {
    const { token } = await registerUser(app);

    const unknown = await upvote(token, '6a60b8659c16fbcbeab13e49');
    const malformed = await upvote(token, 'nonsense');

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(400);
  });

  it('reconciles a counter that has drifted away from the source of truth', async () => {
    const tool = await seedTool({ name: 'Drifted' });
    const { token } = await registerUser(app);
    await upvote(token, tool._id.toString());

    // Simulate a crash between the upvote insert and the counter increment.
    await Tool.findByIdAndUpdate(tool._id, { $set: { upvoteCount: 99 } });

    const result = await reconcileUpvoteCounts();

    expect(result.corrected).toBe(1);
    expect(result.corrections[0]).toMatchObject({ from: 99, to: 1 });
    expect((await Tool.findById(tool._id))?.upvoteCount).toBe(1);
  });
});
