import Tool from '@/db/models/tool.model';
import Upvote from '@/db/models/upvote.model';
import User from '@/db/models/user.model';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * Tests run against a real MongoDB — nothing about the ranking pipelines
 * (`$$NOW`, `$setIntersection`, unique-index races) survives being mocked.
 *
 * Set `TEST_DATABASE_URL` to use a real server; a scratch database on the same
 * Atlas cluster works well and is what .env.example suggests. With it unset the
 * suite falls back to an ephemeral in-memory server, which needs no
 * infrastructure but downloads a ~600 MB binary on first use
 * (`npm run test:warm` does that once, up front).
 *
 * Either way the suite owns that database completely and clears every
 * collection between tests. Never point it at anything you care about.
 *
 * NODE_ENV and the other test variables are set in vitest.config.ts, not here —
 * see the comment there for why.
 */
const EXTERNAL_URI = process.env.TEST_DATABASE_URL;

let memoryServer: { stop: () => Promise<boolean> } | undefined;

beforeAll(async () => {
  if (EXTERNAL_URI) {
    await mongoose.connect(EXTERNAL_URI, { dbName: 'toolbeam_test' });
  } else {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongo = await MongoMemoryServer.create();
    memoryServer = mongo;
    await mongoose.connect(mongo.getUri(), { dbName: 'toolbeam_test' });
  }

  // Index builds are asynchronous and are NOT awaited by connect(). Without
  // this the unique { user, tool } index may not exist yet when the first
  // duplicate-upvote test runs, and the 409 it asserts would never fire.
  await Promise.all([User.init(), Tool.init(), Upvote.init()]);
}, 900_000);

afterEach(async () => {
  const { collections } = mongoose.connection;

  // Clear documents but leave indexes intact — dropping collections would take
  // the unique indexes with them.
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await memoryServer?.stop();
});
