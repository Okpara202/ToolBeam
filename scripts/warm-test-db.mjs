/**
 * Downloads and caches the MongoDB binary that `mongodb-memory-server` needs.
 *
 * The first `npm test` on a new machine otherwise stalls for several minutes
 * inside a `beforeAll` hook while it fetches ~600 MB, which reads like a hung
 * test run. Doing it here makes the wait explicit and one-off.
 *
 *   node scripts/warm-test-db.mjs
 *
 * Not needed at all if you set TEST_DATABASE_URL to a real database.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const started = Date.now();
console.log('Fetching the MongoDB binary — one time only, then it is cached.\n');

const mongo = await MongoMemoryServer.create();

console.log(`\nStarted at ${mongo.getUri()}`);
console.log(`Ready in ${Math.round((Date.now() - started) / 1000)}s`);

await mongo.stop();

console.log('BINARY CACHED OK — `npm test` will start instantly from now on.');
