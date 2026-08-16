import { SEED_USER_EMAIL, SEED_USER_PASSWORD, assertRequiredEnv } from '@/config/env.config';
import { connectDB, disconnectDB } from '@/db';
import Tool from '@/db/models/tool.model';
import Upvote from '@/db/models/upvote.model';
import User from '@/db/models/user.model';
import { extractKeywords, hashPassword, normalizeLink, normalizeTags } from '@/utils/helper.util';
import { ANCHOR_TOOL_NAMES, SEED_TOOLS } from './seed-data';
import { Types } from 'mongoose';

const MS_PER_DAY = 86_400_000;

/**
 * Builds a deterministic ObjectId from a prefix and an index.
 *
 * Left to Mongo, every re-seed would mint fresh ids, silently invalidating any
 * id already saved in a Postman environment, a bookmark or a shared link. The
 * data this script produces is already byte-identical between runs; making the
 * ids stable too is what actually delivers on that — re-seeding now restores
 * exactly the previous state rather than an equivalent-but-renamed one.
 *
 * An ObjectId is 12 bytes / 24 hex characters. The prefixes below are hex-safe
 * and chosen to be obviously synthetic, so a seeded id is recognisable on sight.
 */
const stableId = (prefix: string, index: number) =>
  new Types.ObjectId(prefix + index.toString(16).padStart(24 - prefix.length, '0'));

const USER_ID_PREFIX = '5eeded'; // "seeded"
const TOOL_ID_PREFIX = '7001bea'; // "toolbea", leetspeak so every character is valid hex

/**
 * Enough accounts to back the largest upvote count in the catalogue, since the
 * unique { user, tool } index means one member can only ever contribute one
 * upvote to a given tool.
 */
const MEMBER_COUNT = 360;

/**
 * Deterministic PRNG (mulberry32) so two runs of the seed produce byte-identical
 * data. Without it, re-seeding would quietly reshuffle every ranking, making it
 * impossible to tell a genuine regression from ordinary randomness.
 */
const createRandom = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const random = createRandom(20260816);

async function seed() {
  assertRequiredEnv();
  await connectDB();

  const now = Date.now();

  console.log('\nClearing existing data…');
  await Promise.all([Tool.deleteMany({}), Upvote.deleteMany({}), User.deleteMany({})]);

  // Guarantees the unique indexes exist on a freshly created Atlas database —
  // without them the idempotent-upvote and duplicate-link rules would silently
  // not be enforced.
  console.log('Syncing indexes…');
  await Promise.all([User.syncIndexes(), Tool.syncIndexes(), Upvote.syncIndexes()]);

  // --- users -------------------------------------------------------------
  // Hashed once and shared. argon2 is intentionally slow; hashing 361 times
  // would add minutes to a seed for no benefit, since these are throwaway
  // accounts that all share one password anyway.
  console.log('Hashing seed password…');
  const password = await hashPassword(SEED_USER_PASSWORD);

  const memberDocs = Array.from({ length: MEMBER_COUNT }, (_, i) => ({
    _id: stableId(USER_ID_PREFIX, i + 1),
    name: `Toolbeam Member ${i + 1}`,
    email: `member${i + 1}@toolbeam.dev`,
    password,
  }));

  console.log(`Creating ${MEMBER_COUNT + 1} users…`);
  // Deliberately excluded from the upvoters below, so this account starts with
  // a clean slate and can upvote any tool without hitting ALREADY_UPVOTED.
  await User.create({
    _id: stableId(USER_ID_PREFIX, 0),
    name: 'Toolbeam Demo',
    email: SEED_USER_EMAIL,
    password,
  });
  const members = await User.insertMany(memberDocs);

  // --- tools -------------------------------------------------------------
  console.log(`Creating ${SEED_TOOLS.length} tools…`);
  const toolDocs = SEED_TOOLS.map((tool, index) => {
    const createdAt = new Date(now - tool.ageDays * MS_PER_DAY);

    return {
      _id: stableId(TOOL_ID_PREFIX, index),
      name: tool.name,
      description: tool.description,
      category: tool.category,
      link: tool.link,
      linkKey: normalizeLink(tool.link),
      tags: normalizeTags(tool.tags),
      // Derived with the same helper the submit endpoint uses, so a seeded tool
      // and one created through the API score identically in the related
      // pipeline. Any divergence would make seeded data behave unlike real data.
      keywords: extractKeywords(tool.name, tool.description),
      submittedBy: (members[Math.floor(random() * members.length)] as { _id: Types.ObjectId })._id,
      upvoteCount: tool.upvotes,
      createdAt,
      updatedAt: createdAt,
    };
  });

  // `timestamps: false` so the backdated createdAt survives — otherwise
  // mongoose overwrites every one of them with "now" and the age decay has
  // nothing to work with.
  const tools = await Tool.insertMany(toolDocs, { timestamps: false });

  // --- upvotes -----------------------------------------------------------
  // Real Upvote documents, not just a counter. The whole popularity design
  // rests on this collection being the source of truth, so seeding a bare count
  // would produce a database that `npm run reconcile` would correctly wipe back
  // to zero, and windowed ranking would have no timestamps to work with.
  console.log('Creating upvote documents…');
  const upvoteDocs: {
    user: Types.ObjectId;
    tool: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];

  tools.forEach((tool, toolIndex) => {
    const spec = SEED_TOOLS[toolIndex];
    const toolCreatedAt = now - spec.ageDays * MS_PER_DAY;
    const lifespan = now - toolCreatedAt;
    // Rotating offset so each tool draws a different slice of the membership,
    // rather than every tool being upvoted by members 1..N.
    const offset = toolIndex * 37;

    for (let i = 0; i < spec.upvotes; i += 1) {
      const member = members[(offset + i) % members.length] as { _id: Types.ObjectId };

      // Votes spread across the tool's lifetime, so ?window=week and
      // ?window=month have real data to rank rather than being empty.
      const at = new Date(toolCreatedAt + lifespan * ((i + random()) / spec.upvotes));

      upvoteDocs.push({
        user: member._id,
        tool: (tool as { _id: Types.ObjectId })._id,
        createdAt: at,
        updatedAt: at,
      });
    }
  });

  // Batched — a single insertMany of tens of thousands of documents can exceed
  // the driver's message size limit.
  const BATCH = 2000;
  for (let i = 0; i < upvoteDocs.length; i += BATCH) {
    await Upvote.insertMany(upvoteDocs.slice(i, i + BATCH), { timestamps: false });
  }

  // --- summary -----------------------------------------------------------
  const anchors = await Tool.find({ name: { $in: [...ANCHOR_TOOL_NAMES] } });
  const [recent] = await Tool.find().sort({ createdAt: -1 }).limit(1);

  const line = '─'.repeat(74);
  console.log(`\n${line}`);
  console.log('  TOOLBEAM SEED COMPLETE');
  console.log(line);
  console.log(`  Users            ${MEMBER_COUNT + 1}`);
  console.log(`  Tools            ${tools.length}`);
  console.log(`  Upvotes          ${upvoteDocs.length}`);
  console.log('');
  console.log('  TEST ACCOUNT');
  console.log(`    email          ${SEED_USER_EMAIL}`);
  console.log(`    password       ${SEED_USER_PASSWORD}`);
  console.log('    Holds none of the seeded upvotes, so it starts with a clean');
  console.log('    slate and can upvote any tool without hitting ALREADY_UPVOTED.');
  console.log('');
  console.log('  SAMPLE TOOL IDS — two different categories, for comparing /related');

  for (const name of ANCHOR_TOOL_NAMES) {
    const tool = anchors.find((candidate) => candidate.name === name);
    if (!tool) continue;

    console.log('');
    console.log(`    ${tool.name}`);
    console.log(`      id           ${tool._id.toString()}`);
    console.log(`      category     ${tool.category}`);
    console.log(`      tags         ${tool.tags.join(', ')}`);
    console.log(`      related      GET /api/v1/tools/${tool._id.toString()}/related`);
  }

  if (recent) {
    console.log('');
    console.log('  NEWEST TOOL');
    console.log(`    ${recent.name} — ${recent._id.toString()} (${recent.upvoteCount} upvotes)`);
  }

  console.log('');
  console.log('  SAMPLE SUBMISSION');
  console.log('    POST /api/v1/tools');
  console.log(
    '    ' +
      JSON.stringify({
        name: 'Toolbeam Scout',
        description:
          'Watches product launch feeds and surfaces newly released AI tools with a short summary of what each one does.',
        category: 'research',
        link: 'https://scout.toolbeam.dev',
        tags: ['research', 'search', 'discovery', 'answer-engine'],
      }),
  );
  console.log('');
  console.log('    Category "research" plus those tags put Perplexity / Elicit /');
  console.log('    Consensus at the top of its related list — a different set from');
  console.log('    either sample id above, and it works with zero upvotes.');
  console.log(line + '\n');

  await disconnectDB();
}

seed()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('\nSeed failed:', err);
    await disconnectDB().catch(() => undefined);
    process.exit(1);
  });
