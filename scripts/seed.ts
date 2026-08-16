import { SEED_USER_EMAIL, SEED_USER_PASSWORD, assertRequiredEnv } from '@/config/env.config';
import { connectDB, disconnectDB } from '@/db';
import Tool from '@/db/models/tool.model';
import Upvote from '@/db/models/upvote.model';
import User from '@/db/models/user.model';
import { extractKeywords, hashPassword, normalizeLink, normalizeTags } from '@/utils/helper.util';
import { ANCHOR_TOOL_NAMES, SEED_TOOLS } from './seed-data';
import type { Types } from 'mongoose';

const MS_PER_DAY = 86_400_000;

/**
 * Enough accounts to back the largest upvote count in the catalogue, since the
 * unique { user, tool } index means one member can only ever contribute one
 * upvote to a given tool.
 */
const MEMBER_COUNT = 360;

/**
 * Deterministic PRNG (mulberry32) so two runs of the seed produce byte-identical
 * data. Without it, re-seeding between rehearsal and recording would quietly
 * reshuffle the rankings and invalidate any tool ids already pasted into Postman.
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
    name: `Toolbeam Member ${i + 1}`,
    email: `member${i + 1}@toolbeam.dev`,
    password,
  }));

  console.log(`Creating ${MEMBER_COUNT + 1} users…`);
  // The demo account is created but never used as an upvoter below, so it can
  // upvote anything during the recording without hitting ALREADY_UPVOTED.
  await User.create({ name: 'Toolbeam Demo', email: SEED_USER_EMAIL, password });
  const members = await User.insertMany(memberDocs);

  // --- tools -------------------------------------------------------------
  console.log(`Creating ${SEED_TOOLS.length} tools…`);
  const toolDocs = SEED_TOOLS.map((tool) => {
    const createdAt = new Date(now - tool.ageDays * MS_PER_DAY);

    return {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      link: tool.link,
      linkKey: normalizeLink(tool.link),
      tags: normalizeTags(tool.tags),
      // Derived exactly as the live submit endpoint derives them, so seeded
      // tools and demo-submitted tools score identically in the related
      // pipeline. Any divergence here would make the demo misleading.
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
  // rests on this collection being the source of truth, so seeding a bare
  // count would produce a database that `npm run reconcile` would wipe back to
  // zero — and a demo that lies about how the system works.
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

  // --- cheat sheet -------------------------------------------------------
  const anchors = await Tool.find({ name: { $in: [...ANCHOR_TOOL_NAMES] } });
  const [recent] = await Tool.find().sort({ createdAt: -1 }).limit(1);

  const line = '─'.repeat(74);
  console.log(`\n${line}`);
  console.log('  TOOLBEAM SEED COMPLETE — DEMO CHEAT SHEET');
  console.log(line);
  console.log(`  Users            ${MEMBER_COUNT + 1}`);
  console.log(`  Tools            ${tools.length}`);
  console.log(`  Upvotes          ${upvoteDocs.length}`);
  console.log('');
  console.log('  DEMO LOGIN');
  console.log(`    email          ${SEED_USER_EMAIL}`);
  console.log(`    password       ${SEED_USER_PASSWORD}`);
  console.log('    This account casts none of the seeded upvotes, so it can');
  console.log('    upvote any tool on camera without hitting the 409.');
  console.log('');
  console.log('  ANCHOR TOOLS — for the two back-to-back related lookups');

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
    console.log('  NEWEST SEEDED TOOL');
    console.log(`    ${recent.name} — ${recent._id.toString()} (${recent.upvoteCount} upvotes)`);
  }

  console.log('');
  console.log('  SUGGESTED SUBMISSION FOR THE DEMO');
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
  console.log('    Category "research" and the shared tags mean this lands on');
  console.log('    top of Perplexity / Elicit / Consensus in its related list —');
  console.log('    visibly different from either anchor, with zero upvotes.');
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
