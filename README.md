# Toolbeam

**The backend API for an AI tools directory.** Submit AI tools, upvote them, and discover them three ways: by recency, by popularity, and by relation.

Thousands of AI tools launch every month. Finding the right one is not a search problem, it is a ranking problem. Toolbeam is the layer that does that ranking: a beacon through the noise, pointing builders at the tool that actually fits.

---

## Contents

- [Quick start](#quick-start)
- [API](#api)
- [How Popular works](#how-popular-works) ← the design write-up
- [How Related works](#how-related-works)
- [Data model](#data-model)
- [Architecture](#architecture)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Quick start

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and JWT_ACCESS_SECRET
npm run seed                  # ~50 tools, ~360 users, thousands of real upvotes
npm run dev                   # http://localhost:8000/docs
```

`npm run seed` prints a **demo cheat sheet** on completion — the demo login, the anchor tool ids, and a ready-to-paste submission payload.

| Script | What it does |
| --- | --- |
| `npm run dev` | Watch-mode server on `PORT` (default 8000) |
| `npm run build` / `npm start` | Bundle to `dist/` and run it |
| `npm run seed` | Wipe and reload the directory, then print the cheat sheet |
| `npm run reconcile` | Rebuild every `upvoteCount` from the upvotes collection |
| `npm test` | Integration suite against an in-memory MongoDB |
| `npm run type-check` / `npm run lint` | Static checks |

### Environment

See [`.env.example`](.env.example). Only two variables are genuinely required — `DATABASE_URL` and `JWT_ACCESS_SECRET` — and the server refuses to boot without them rather than starting in a broken state.

---

## API

Base path `/api/v1`. Interactive docs at `/docs`, raw spec at `/docs.json`.

| Method | Path | Auth | |
| --- | --- | :---: | --- |
| `POST` | `/auth/register` | | Create an account, returns a token |
| `POST` | `/auth/login` | | Returns a token |
| `GET` | `/auth/me` | 🔒 | The current user |
| `POST` | `/tools` | 🔒 | Submit a tool |
| `GET` | `/tools` | | Browse, with `?category` `?search` `?page` `?limit` |
| `GET` | `/tools/recent` | | **Newest first** |
| `GET` | `/tools/popular` | | **Upvotes discounted by age**, `?window=all\|week\|month` |
| `GET` | `/tools/:id` | | A single tool |
| `GET` | `/tools/:id/related` | | **Tools related to this one** |
| `POST` | `/tools/:id/upvote` | 🔒 | Upvote — one per user per tool |
| `DELETE` | `/tools/:id/upvote` | 🔒 | Remove your upvote |
| `GET` | `/categories` | | The category taxonomy |

Every response uses one envelope:

```jsonc
// success
{ "success": true, "message": "…", "data": … }

// error
{ "success": false, "error": { "message": "Tool not found", "code": "TOOL_NOT_FOUND" } }

// validation error — keyed by field, so a client can attach each message to its input
{ "success": false, "errors": { "description": "Description must be at least 20 characters" } }
```

---

## How Popular works

> The three questions this answers: *what makes a tool popular, how is that stored, and how does the API calculate and return it.*

### What makes a tool popular

**Upvotes, discounted by how long the tool has had to collect them.**

Raw upvote count is the obvious answer and the wrong one. It measures accumulated age as much as quality: whatever launched first has had the most time to gather votes, so a raw-count leaderboard freezes on day one and never moves again. That is the exact failure this directory exists to prevent — the whole problem is that good new tools are invisible.

So a tool that gathered 50 upvotes last week ranks above one that gathered 60 over two years. The second is a bigger number and a weaker signal.

### How it is stored

Two tiers, and the score is deliberately not one of them.

**1. The `upvotes` collection is the source of truth.** One document per `(user, tool)`, carrying a timestamp.

```js
upvoteSchema.index({ user: 1, tool: 1 }, { unique: true });
```

That index is the idempotency guarantee, and it lives in the database rather than in application code on purpose. A check-then-insert in the service would still let two concurrent requests from the same user both pass the check and both insert. The unique index rejects the second write no matter how the requests interleave; the service catches the `E11000` and returns `409 ALREADY_UPVOTED`. There is [a test](tests/integration/upvote.spec.ts) that fires five simultaneous upvotes and asserts exactly one succeeds.

**2. `tools.upvoteCount` is a denormalized counter.** Moved by an atomic `$inc`, indexed `{ upvoteCount: -1 }`. It exists so a ranking read never has to count documents across two collections.

**3. The score itself is never stored.** This is the important part. The score changes every second for no reason other than tools getting older — so any value written to disk is stale the instant it lands, and keeping it fresh would mean a cron job rewriting every document in the collection forever. Storing it would buy a faster sort and cost correctness. It is computed at read time instead.

*The trade-off, stated plainly:* the insert and the `$inc` are two operations, not a transaction. A crash between them leaves the counter one short. That is why `npm run reconcile` exists — it recounts from the source of truth and corrects the cache. An upvote tally does not justify the latency of a distributed transaction on every vote, and the worst case is a slightly low number rather than a lost or duplicated vote.

### How it is calculated and returned

```
score = upvoteCount / (ageHours + 2) ^ 1.5
```

A MongoDB aggregation, in [`src/services/ranking.service.ts`](src/services/ranking.service.ts):

```js
{ $addFields: {
    ageHours: { $divide: [{ $subtract: ['$$NOW', '$createdAt'] }, 3600000] },
}},
{ $addFields: {
    popularityScore: {
      $divide: ['$upvoteCount', { $pow: [{ $add: ['$ageHours', 2] }, 1.5] }],
    },
}},
{ $sort: { popularityScore: -1, upvoteCount: -1, createdAt: -1 } },
{ $limit: limit },
```

`$$NOW` is the server clock at the moment of the query, which is what makes the score always current without anything being stored or refreshed.

Three deliberate choices in that formula:

- **`1.5` gravity** — the Hacker News exponent. High enough that a genuinely new tool can break through, low enough that a landmark tool does not vanish within a week.
- **`+2` offset** — stops the denominator collapsing toward zero for a tool submitted seconds ago.
- **No `+1` on the numerator.** A tool with zero upvotes must score exactly zero and sink. Smooth it and `/popular` starts ranking brand-new tools highly on recency alone, which is what `/recent` is already for.

Every weight lives in [`src/constants/ranking.ts`](src/constants/ranking.ts), not scattered through the pipeline.

The score and the age it was computed from are both returned in the response, so the ordering can be checked by hand:

```jsonc
{
  "name": "Devin",
  "upvoteCount": 46,
  "ageHours": 120.3,
  "popularityScore": 0.034161      // 46 / (120.3 + 2)^1.5
}
```

### `?window=week|month` — trending

A different question, so a different pipeline. This ranks by upvotes cast **inside** the window, with **no age decay** — the window already bounds recency, and decaying by tool age on top of it would penalise an older tool that is genuinely having a resurgence.

It also runs off the `upvotes` collection rather than the `tools` collection, grouping by tool. Starting from the votes means it only touches tools that actually received one in the window, instead of scanning the whole directory to discover that most of them received none.

---

## How Related works

Two constraints shaped this.

**It must work for a tool submitted seconds ago.** Zero upvotes, no interaction history. That rules out collaborative filtering — "users who upvoted this also upvoted…" needs dense voting data, and on a young directory it degrades into noise. Noise is worse than useless in a discovery product, and it cannot answer the case that matters most: what do I show next to something brand new?

**It must never return an empty list.** A dead end is the worst possible outcome for someone browsing.

So relatedness is content-based, scored across three overlapping attributes and tie-broken by popularity:

```
score = 3 x (same category)
      + 2 x |shared tags|
      + 1 x |shared keywords|
      + 0.5 x min(1, upvotes / 100)
```

All three signals are **arrays**, which is the trick that makes this cheap: each one is a `$setIntersection` inside a single pass, with no text index and no second query.

- **`tags`** are author-supplied and curated.
- **`keywords`** are derived from the name and description on write, lowercased and stopword-filtered ([`extractKeywords`](src/utils/helper.util.ts)). Deriving them into an array is what lets free-text similarity join the same cheap shape as tag overlap. They are never accepted from a client — otherwise a submitter could keyword-stuff their way into every related list on the site.
- The stopword list drops directory-generic vocabulary — *ai, tool, platform, powered* — on top of ordinary English. Left in, those appear in nearly every description and would make everything look related to everything.

**Popularity is weighted lowest and saturates**, so it only ever separates two equally-related tools. A famous but unrelated tool can never outrank a genuine match.

**Backfill.** If fewer than `limit` tools genuinely match, the tail is topped up with popular tools carrying `relevanceScore: 0` and an empty `matchedOn` — the response saying plainly *nothing really matched, here is what people are upvoting instead*.

**The response explains itself.** Every result carries the reason it matched:

```jsonc
{
  "name": "Perplexity",
  "relevanceScore": 9.5,
  "matchedOn": {
    "sameCategory": true,
    "sharedTags": ["search", "answer-engine"],
    "sharedKeywords": ["citations", "sources"]
  }
}
```

*Left open on purpose:* a collaborative boost term slots into the same `$add` without changing the pipeline's shape, once there is enough voting data for it to mean something.

---

## Data model

**`users`** — `name`, `email` (unique), `password` (argon2id, `select: false`).

**`tools`**

| Field | Notes |
| --- | --- |
| `name`, `description`, `category`, `link` | The submission |
| `linkKey` | Link with protocol, `www.` and trailing slash stripped, **unique** — so `https://WWW.Midjourney.com/` and `http://midjourney.com` are recognised as one tool |
| `tags` | Author-supplied, lowercased |
| `keywords` | Derived on write, internal — never returned by the API |
| `submittedBy` | → `users` |
| `upvoteCount` | Denormalized cache of the upvotes collection |

Indexed on `createdAt`, `upvoteCount`, `category`, `tags`, `keywords` — one index per access path used by the three discovery endpoints.

**`upvotes`** — `user`, `tool`, timestamps. Unique on `{ user, tool }`; secondary index on `{ tool, createdAt }` for the windowed view.

---

## Architecture

```
src/
  app.ts  server.ts          Express wiring, graceful shutdown
  config/                    env, cors, logging
  constants/                 categories, ranking weights, error codes, messages
  db/models/                 mongoose schemas + indexes
  errors/                    AppError and its typed constructors
  lib/                       OpenAPI registry and per-domain doc modules
  middlewares/               auth, zod validation, error handler
  routes/                    thin — mapping only
  services/                  all behaviour
    ranking.service.ts         <- popular + related live here
  utils/                     hashing, keyword extraction, link normalisation
  validations/               zod schemas — the single source of truth
```

Routes map, controllers translate HTTP, services hold the behaviour. Two conventions are worth calling out:

**Zod schemas are the only definition of a request shape.** [`lib/tool.docs.ts`](src/lib/tool.docs.ts) imports the same schemas [`routes/tool.routes.ts`](src/routes/tool.routes.ts) validates with, so the Swagger page cannot drift from what the API actually accepts. A [spec test](tests/integration/docs.spec.ts) asserts the documented endpoint list matches the real one exactly, in both directions.

**Route order in [`tool.routes.ts`](src/routes/tool.routes.ts) is load-bearing.** `/recent` and `/popular` are declared above `/:id`. Express matches top to bottom, so reversing them would make `/:id` swallow the literal string `"recent"` and try to cast it to an ObjectId. There is a comment at that line and a regression test guarding it.

---

## Testing

```bash
npm test
```

63 integration tests over a **real MongoDB** — nothing is mocked, because nothing about the ranking pipelines (`$$NOW`, `$setIntersection`, unique-index races) survives being mocked.

Set `TEST_DATABASE_URL` to a scratch database — `toolbeam_test` on the same Atlas cluster works — and the suite uses it. Leave it unset and it falls back to an ephemeral in-memory server, which needs no cluster but downloads a ~600 MB MongoDB binary on first use; `npm run test:warm` gets that out of the way up front. Either way the suite owns that database and clears every collection between tests.

| Spec | Covers |
| --- | --- |
| [`auth.spec.ts`](tests/integration/auth.spec.ts) | Register, login, token handling, no account-enumeration oracle |
| [`tools.spec.ts`](tests/integration/tools.spec.ts) | Submission, validation, link de-duplication, `/recent` ordering, route-order regression |
| [`upvote.spec.ts`](tests/integration/upvote.spec.ts) | Counter accuracy, duplicate rejection, **concurrency**, reconciliation |
| [`related.spec.ts`](tests/integration/related.spec.ts) | Different tools → different sets, zero-upvote tools, backfill, self-exclusion |
| [`popular.spec.ts`](tests/integration/popular.spec.ts) | Recency beats volume, volume still counts at equal age, windowed trending |
| [`docs.spec.ts`](tests/integration/docs.spec.ts) | Spec covers every route and nothing more |

Test environment variables are set in [`vitest.config.ts`](vitest.config.ts) rather than in `tests/setup.ts`. ES module imports are hoisted and evaluated before the importing module's body, so an assignment at the top of the setup file would land *after* `env.config.ts` had already read `process.env`.

---

## Deployment

Deployed as a Render web service; see [`render.yaml`](render.yaml).

- Build `npm ci && npm run build`, start `npm start`, health check `/health`.
- Set `DATABASE_URL`, `JWT_ACCESS_SECRET` and `API_BASE_URL` in the dashboard.
- Atlas → **Network Access** must allow `0.0.0.0/0`; Render's egress IPs are dynamic.
- Docs are gated on `ENABLE_DOCS`, not on `NODE_ENV`, so the deployed instance serves its own Swagger UI.
- **Free tier cold-starts take 30–50 seconds.** Hit the URL once to wake it before doing anything that matters.

---

## License

MIT
