import { assertRequiredEnv } from '@/config/env.config';
import { connectDB, disconnectDB } from '@/db';
import { reconcileUpvoteCounts } from '@/services/upvote.service';

/**
 * Rebuilds every `Tool.upvoteCount` from the `upvotes` collection.
 *
 * The upvote write path is two operations — insert the vote, then bump the
 * counter — and they are deliberately not wrapped in a transaction. This is the
 * repair that makes that trade safe: the source of truth is re-counted and the
 * cache is corrected to match.
 */
async function reconcile() {
  assertRequiredEnv();
  await connectDB();

  const { checked, corrected, corrections } = await reconcileUpvoteCounts();

  console.log(`\nChecked ${checked} tools.`);

  if (!corrected) {
    console.log('All counters already agree with the upvotes collection.\n');
  } else {
    console.log(`Corrected ${corrected}:`);
    for (const { id, from, to } of corrections) {
      console.log(`  ${id}  ${from} -> ${to}`);
    }
    console.log('');
  }

  await disconnectDB();
}

reconcile()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('\nReconcile failed:', err);
    await disconnectDB().catch(() => undefined);
    process.exit(1);
  });
