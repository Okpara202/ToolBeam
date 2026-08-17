# Toolbeam — Run Sheet

**~6:15 total** — 45s under the limit

Intro 1:00 · Demo 2:50 · Answer 2:10 · Close 0:15

*If you're past **4:15** when you finish Step 7, skip the optional follow-ups at the end and go straight to the close.*

---

## STEP 0 — Before recording

1. Open `toolbeam.onrender.com/health` → wait for `{"status":"ok"}`
2. Postman → environment **Toolbeam — Production**
3. Open folder **1. Quickstart**
4. Send **`0. Log in`**

Token captured. Don't mention this on camera. **Record.**

---

## STEP 1 — Intro · 1:00

*Face on camera.*

> Hi, I'm ⟨name⟩. This is **Toolbeam** — a backend API for an AI tools directory.

> Thousands of AI tools launch every month. The hard part isn't finding them, it's that there are too many. So this isn't a search problem. It's a **ranking** problem. Not "what exists", but "which one should you look at first".

> That's the name. A beam cuts through noise and points at one thing. Toolbeam points you at the right tool three ways — what's **new**, what's **genuinely popular right now**, and what's **related** to something you already like.

> Node, Express and MongoDB. The interesting part is the ranking, and I'll come back to that. Let me show you.

**→ Share screen.**

---

## STEP 2 — Submit · 0:25

**`1. Submit a new AI tool` → Send**

> I'm logged in, so I'm carrying a token that proves who I am. Submitting needs that — browsing doesn't.

> Adding a new tool now. Name, description, category, link, tags.

**`201 Created`** — point at `upvoteCount: 0`

> Created. And notice — **zero upvotes**. Nobody's voted on it. Remember that.

---

## STEP 3 — Recent · 0:20

**`2. Recent Tools` → Send**

> First way to discover things: what's new.

**Point at position 1**

> Top of the list — the tool I just submitted.

> This one sorts by date and nothing else. Deliberately — "newest" should mean exactly one thing. The clever ranking comes later.

✅ **20 pts**

---

## STEP 4 — Upvote · 0:35

**`3. Upvote a tool` → Send** → `200`

> Second thing users do: upvote. That's the signal everything is built on.

> 340 to 341.

> So what stops one person voting a hundred times? Let me try.

**Send again** → `409`

> Rejected.

> And that's not my code checking first — that check would actually be **unsafe**. Two requests arriving at the same moment could both look, both see nothing, both write.

> Instead the **database** enforces it. One vote per person per tool, as a rule on the data itself. A second one physically can't exist.

✅ **20 pts**

---

## STEP 5 — Related, existing tool · 0:30

**`4. Related Tools — existing tool` → Send**

> Third way: related tools. You're looking at one thing — what else should you see?

> What's related to **Midjourney**, an image tool?

**DALL·E, Ideogram, Stable Diffusion**

> All image tools.

**Point at `matchedOn`**

> And it's not a black box. Every result explains itself — same category, these shared tags, these shared keywords, and the score they add up to.

---

## STEP 6 — Related, the NEW tool · 0:35

**`5. Related Tools — the newly submitted tool` → Send**

> Now the part I care about most. Same endpoint — but the tool I submitted a minute ago. **Zero upvotes.** No history at all.

**Perplexity, Elicit, Consensus**

> Completely different list. All research tools, which is what I submitted.

> The usual way to do "related" is behaviour — people who liked this also liked that. That works on Netflix. Here it fails: a tool thirty seconds old has no behaviour, so it'd come back empty exactly when a new tool most needs to be found.

> So I match on **content** instead — category, tags, and words from its own description.

✅ **20 pts**

---

## STEP 7 — Popular · 0:20

**`6. Popular Tools` → Send**

> Which brings me to the last one, and the design decision I most want to explain — **Popular**.

> Look at these numbers, because they look wrong.

```
1. Devin              46 upvotes    6d
2. NotebookLM Audio   39 upvotes    9d
3. Flux               54 upvotes   13d
```

**→ Leave on screen. Straight into Step 8. You're at ~4:00.**

---

## STEP 8 — Design answer · 2:10

### Part 1 · What makes a tool popular

> Devin is number one with **46 upvotes**. Midjourney, which we just upvoted, has **341** — and isn't in the top five. That's not a bug, that's the design.

> Popular here means **upvotes, discounted by age**.

> Think about what a raw count measures. Whatever launched first had the most time to collect votes. So a plain leaderboard ranks *age*, not quality — it locks in on day one and never moves. That's exactly the problem this directory exists to solve.

> Fifty upvotes last week beats sixty over two years.

### Part 2 · How it's stored

> Storage is two layers — and the interesting bit is what I **don't** store.

> **One:** every upvote is its own record. Who voted, which tool, when. That's the source of truth, and it's what that uniqueness rule protects.

> **Two:** a running total on each tool. Duplicate information technically, but ranking reads one number instead of counting thousands of records.

> **And three — I never store the score.** It changes every second just because tools get older. Anything I saved would be stale immediately, and keeping it fresh means rewriting every tool, forever.

### Part 3 · How it's calculated

> So it's worked out the moment you ask, by MongoDB, inside the database.

> The formula: **upvote count, divided by age in hours plus two, to the power one point five.**

*(pause)*

> The age is the server's clock at that instant, so it's always current. The **one point five** controls how fast old things fade — the same constant Hacker News uses. Steep enough that something new breaks through, gentle enough that a great tool doesn't vanish in a week.

> And nothing gets added to the top of that fraction. Zero upvotes scores exactly zero and sinks — otherwise Popular slowly turns into a second copy of Recent.

> The score and the age both come back in the response, so you can check the ordering yourself.

✅ **30 pts**

---

## STEP 9 — Close · 0:15

**Switch to `toolbeam.onrender.com/docs`**

> It's deployed and live, and these docs are generated from the same rules that validate the real requests — so they can't drift from the API.

> That's Toolbeam. Thanks for watching.

✅ **10 pts**

---

## Follow-ups, if asked

**Weekly view:**
> There's also a week window — ranks by votes cast inside that week, with no age decay, because the window already handles recency.

**Trade-off:**
> Recording the vote and bumping the counter are two writes, not one transaction. A crash between them leaves the counter one low. Deliberate — a transaction on every upvote isn't worth the latency, and worst case is a slightly low number, never a lost vote. A script recounts and repairs it.

---

## If something breaks

**Hangs ~30s** → cold start, keep talking

**409 on first upvote** → used it rehearsing; upvote a different tool, or lean in: "that's the guarantee working"

**401** → re-send `0. Log in`

**Related list full of "Toolbeam Scout" copies** → stop, `npm run seed`, restart

---

## Three habits

1. **Why before what.** Every step opens with the problem.
2. **Say the formula slowly.** Then pause.
3. **Let 46 beating 341 do the work.** Looks like a mistake for two seconds — then you explain it, and it proves the design was intentional.
