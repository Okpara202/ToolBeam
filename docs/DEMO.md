# Demo run sheet

Everything needed to record the submission video. Total runtime under 7 minutes: **1 min intro, 3 min demo, 2 min design answer.**

---

## Before you press record

- [ ] **Seed the database.** `npm run seed`. Copy the cheat sheet it prints.
- [ ] **Paste the two anchor tool ids** into the Postman collection variables `anchorToolId` (Midjourney) and `anchorToolIdB` (GitHub Copilot).
- [ ] **Check `baseUrl`** is `https://toolbeam.onrender.com/api/v1` (already set in the collection).
- [ ] **Wake the Render instance.** Open https://toolbeam.onrender.com/health and wait for `{"status":"ok"}`. Free tier cold-starts take 30–50 seconds; hitting a sleeping instance live burns half your demo window.
- [ ] **Run `0. Log in` once.** The token is captured into `{{token}}` automatically and every other request uses it. Do not spend camera time on auth.
- [ ] **Close other tabs.** Have Postman and the Swagger page (`/docs`) open, nothing else.
- [ ] Optional dry run: send requests 1→6 once. `Submit a new AI tool` randomises its own name and link on every send, so rehearsing cannot cause a duplicate-link 409 in the real take.

> **The one thing that could still break:** the demo login casts none of the seeded upvotes, so its first upvote of any tool always succeeds. But if you upvote the *same* tool twice across a rehearsal and the take, the second returns `409 ALREADY_UPVOTED`. Either re-seed, or upvote a different tool in the take. (Or lean into it — firing it twice on purpose is a good 5-second demonstration of the idempotency guarantee.)

---

## 1 · Introduction — 1 minute

Who you are, what this is, why the name.

> "I'm ⟨name⟩. This is **Toolbeam** — the backend API for an AI tools directory.
>
> Thousands of AI tools launch every month, and the problem isn't that they're hard to find, it's that there are too many. So finding the right one isn't a search problem, it's a **ranking** problem.
>
> That's the name. A beam cuts through noise and points at one thing. Toolbeam takes a directory of tools and points you at the right one — three ways: what's **new**, what's **actually popular right now**, and what's **related** to something you already like.
>
> It's Node, Express and MongoDB, with the ranking done in aggregation pipelines. Let me show you."

---

## 2 · Live demo — 3 minutes

Postman → **1. Demo Flow**. Straight down the list. Keep talking while requests fly.

### ① Submit a new AI tool → `POST /tools`

> "I'm logged in, so I've got a bearer token. I'm submitting a new tool — name, description, category, link, and some tags."

Point at the response: **`201`**, and **`upvoteCount: 0`**.

> "Brand new. Nobody's voted on it. Remember that — it matters in a second."

### ② Recent Tools → `GET /tools/recent`

> "Recent is a pure `createdAt` sort off a dedicated index — no scoring at all, because 'newest' should mean exactly one thing."

Point at position 1: **it's the tool just submitted.** The test in the response tab confirms it.

### ③ Upvote → `POST /tools/:id/upvote`

> "Now upvoting a tool. The count goes up."

*(Optional, 5 seconds — send it again.)*

> "Send it twice and you get a 409. And that's not an `if` statement in my code — it's a **unique index on user plus tool** in the database, so two simultaneous requests from the same person still can't both get through."

### ④ Related — existing tool → `GET /tools/:anchorId/related`

> "Related to Midjourney — an image generation tool."

Scroll the results. Point at **`matchedOn`**.

> "Other image tools. And each result tells you *why* it matched — same category, these shared tags, these shared keywords — plus the score that ordering came from. It's not a black box."

### ⑤ Related — the new tool → `GET /tools/:newToolId/related`

> "Same endpoint. Different tool. The one I submitted sixty seconds ago, with **zero upvotes**."

Point at the completely different result set.

> "Totally different results — and it works with no vote history at all, because relatedness here is scored from **content**, not from behaviour. A 'people who upvoted this also upvoted that' approach would return nothing useful for a tool this new. This works from the first second it exists."

### ⑥ Popular → `GET /tools/popular`

Leads directly into the design answer — go straight on.

---

## 3 · Design question — 2 minutes

**"Explain how your Popular Tools endpoint works — what makes a tool popular, how did you store that, and how does your API calculate and return it?"**

Answer it in exactly those three parts.

### Part 1 — What makes a tool popular *(~40s)*

> "Upvotes — but **discounted by age**.
>
> Raw upvote count was the obvious answer and I think it's the wrong one, because it measures how *old* something is as much as how good it is. Whatever launched first has had the longest to collect votes, so a raw leaderboard freezes on day one and never moves. And that's the exact problem this directory exists to solve — good new tools being invisible.
>
> So in Toolbeam, fifty upvotes last week beats sixty upvotes over two years. The second is a bigger number and a weaker signal."

*Point at the response on screen: a tool near the top with far fewer lifetime upvotes than the veterans below it.*

### Part 2 — How it's stored *(~40s)*

> "Two tiers — and the score deliberately isn't one of them.
>
> First, the **upvotes collection is the source of truth**. One document per user per tool, with a **unique compound index on user and tool**. That index is what makes upvoting idempotent, and it's in the database rather than in my service code on purpose — a check-then-insert would still let two concurrent requests from the same user both slip through. The index can't be raced.
>
> Second, **`upvoteCount` on the tool is a denormalized counter**, moved by an atomic `$inc` and indexed. It's a cache, so a ranking read never has to count documents across two collections.
>
> And third — **I never store the score**. It changes every second just because tools get older. Anything I wrote to disk would be stale immediately, and keeping it fresh would mean a cron job rewriting every document forever."

### Part 3 — How it's calculated and returned *(~40s)*

> "So it's computed at read time, in a **MongoDB aggregation pipeline**:
>
> **score equals upvote count, divided by age in hours plus two, to the power one point five.**
>
> The age comes from `$$NOW` — the server clock at the moment of the query — so it's always current with nothing to refresh. The `1.5` is the Hacker News gravity constant: steep enough that something new can break through, gentle enough that a landmark tool doesn't vanish in a week. The `+2` stops the maths blowing up for a tool that's two minutes old. And there's deliberately **no `+1` on the numerator** — a tool with zero upvotes has to score exactly zero and sink, otherwise Popular slowly turns back into Recent.
>
> Then it sorts on that score, limits, and returns it — **with the score and the age included in the response**, so you can check the ranking by hand rather than trusting me.
>
> One more thing: `?window=week` runs a different pipeline entirely — it ranks by votes cast *inside* that window with no decay, because the window already handles recency. And it starts from the upvotes collection rather than scanning every tool, so it only touches tools that actually got a vote."

**If asked about the trade-off:**

> "The vote insert and the counter increment are two writes, not a transaction. A crash between them leaves the counter one low. I chose that deliberately — a distributed transaction on every upvote isn't worth the latency, and the worst case is a slightly low number, never a lost or duplicated vote. There's a `npm run reconcile` script that recounts from the source of truth and repairs the cache."

---

## Endpoint cheat sheet

| | Request |
| --- | --- |
| Submit | `POST {{baseUrl}}/tools` |
| Recent | `GET {{baseUrl}}/tools/recent?limit=5` |
| Upvote | `POST {{baseUrl}}/tools/{{anchorToolId}}/upvote` |
| Related (existing) | `GET {{baseUrl}}/tools/{{anchorToolId}}/related?limit=5` |
| Related (new) | `GET {{baseUrl}}/tools/{{newToolId}}/related?limit=5` |
| Popular | `GET {{baseUrl}}/tools/popular?limit=10` |
| Trending | `GET {{baseUrl}}/tools/popular?window=week` |

## The formulas, for reference

```
popularity  = upvoteCount / (ageHours + 2) ^ 1.5

relevance   = 3 x (same category)
            + 2 x |shared tags|
            + 1 x |shared keywords|
            + 0.5 x min(1, upvotes / 100)
```

---

## If something goes wrong on camera

| Symptom | Cause | Say / do |
| --- | --- | --- |
| Request hangs ~30s | Render cold start | You forgot to warm it. Keep talking, it will land. |
| `409 ALREADY_UPVOTED` | Already upvoted that tool in a rehearsal | Lean in — "that's the idempotency guarantee" — and upvote a different tool. |
| `409 TOOL_ALREADY_EXISTS` | Submit ran without the pre-request script | Change the `link` in the body and resend. |
| `401` | Token expired (7 days) | Send `0. Log in` again. |
| Related list looks thin | Database not seeded | `npm run seed`. |
