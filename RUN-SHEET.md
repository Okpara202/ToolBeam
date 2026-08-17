# Toolbeam — Run Sheet

**Target: ~6:10 total**

- Intro 1:00
- Demo 2:55
- Design answer 2:00
- Close 0:15

---

## STEP 0 — Before recording

1. Open `toolbeam.onrender.com/health` → wait for `{"status":"ok"}`
2. Postman → select **Toolbeam — Production**
3. Open folder **1. Quickstart**
4. Send **`0. Log in`**

Token is now captured. **Do not mention this on camera.**

Start recording.

---

## STEP 1 — Intro (1:00)

*Face on camera. No screen needed.*

> Hi, I'm ⟨name⟩, and this is **Toolbeam** — a backend API for an AI tools directory.

> Here's the problem it solves. Thousands of AI tools launch every single month. If you're a developer looking for the right one, the hard part isn't *finding* tools — it's that there are far too many. So this was never a search problem for me. It's a **ranking** problem. The question isn't "what exists", it's "which one should you look at first".

> That's where the name comes from. A beam cuts through noise and points at one thing. Toolbeam takes a directory full of tools and points you at the right one — in three ways. What's **new**. What's **genuinely popular right now**. And what's **related** to something you already like.

> It's built with Node, Express and MongoDB. The interesting part is the ranking, and I'll show you that at the end. Let me walk through it.

**→ Share screen. Postman open.**

---

## STEP 2 — Submit a tool (0:25)

**Click `1. Submit a new AI tool` → Send**

> So — I'm logged in as a user, which means I'm carrying a token that proves who I am. Submitting a tool needs that; browsing doesn't.

> I'm adding a new tool now. Name, description, category, a link, and a few tags.

**Response: `201 Created`**

> Created. And notice this field here —

**Point at `upvoteCount: 0`**

> — **zero upvotes**. Nobody has voted on it, because it's five seconds old. Hold onto that, because it becomes the most interesting part of this demo in about a minute.

---

## STEP 3 — Recent (0:20)

**Click `2. Recent Tools` → Send**

> First way to discover things: what's new.

**Point at position 1**

> And there it is, top of the list — the tool I just submitted.

> This endpoint does one thing: sorts by creation date. No cleverness at all, and that's deliberate — "newest" should mean exactly one thing to a user. The clever ranking comes later.

✅ **20 points**

---

## STEP 4 — Upvote (0:35)

**Click `3. Upvote a tool` → Send**

> Second thing users can do: upvote. That's the signal the whole ranking is built on.

**Response: `200`, count 340 → 341**

> Midjourney goes from 340 to 341.

> Now — the obvious question with any voting system is: what stops one person voting a hundred times? Let me just try it.

**Send again → `409 ALREADY_UPVOTED`**

> Rejected. Already upvoted.

> And the bit I'd point out — that's not my code checking "has this person voted already" before inserting. That check would actually be **unsafe**, because if two requests arrive at the exact same moment, both could look, both could see nothing, and both could write.

> Instead the **database itself** enforces it. There's a rule on the votes collection saying this user-and-tool pair can only exist once. It's physically impossible to store a second one, no matter how the requests arrive.

✅ **20 points**

---

## STEP 5 — Related, existing tool (0:35)

**Click `4. Related Tools — existing tool` → Send**

> Third way to discover: related tools. If you're looking at one thing, what else should you see?

> Let's ask what's related to **Midjourney** — an image generation tool.

**Result: DALL·E, Ideogram, Stable Diffusion, Leonardo**

> All image tools. That's the right answer.

> But I didn't want it to just be a black box that says "trust me". So every result explains itself —

**Point at `matchedOn`**

> — same category, these tags in common, these keywords in common, and the score those added up to. If a result ever looks wrong, you can see exactly why it got there.

---

## STEP 6 — Related, the NEW tool (0:40)

**Click `5. Related Tools — the newly submitted tool` → Send**

> Now here's the part I actually care about most.

> Same endpoint. But this time I'm asking about the tool I submitted a minute ago — the one with **zero upvotes**, that nobody has ever interacted with.

**Result: Perplexity, Elicit, Consensus**

> Completely different list — all research tools, which is what I submitted.

> And this is a real design decision. The common way to do "related" is to look at behaviour — *people who upvoted this also upvoted that*. It works well on Amazon or Netflix, and it would have failed here completely, because a tool that launched thirty seconds ago has **no** behaviour attached to it. It'd come back empty, exactly when a new tool most needs to be discovered.

> So instead I match on **content** — what the tool actually is. Its category, its tags, and words pulled out of its own description. That works from the very first second a tool exists.

✅ **20 points**

---

## STEP 7 — Popular (0:20)

**Click `6. Popular Tools` → Send**

> Which brings me to the last one, and the design decision I'd most like to explain: **Popular**.

> Now — look at this list, and look at the numbers, because they seem wrong at first glance.

```
1. Devin              46 upvotes    6d
2. NotebookLM Audio   39 upvotes    9d
3. Flux               54 upvotes   13d
```

**→ Leave on screen. Go straight into Step 8. You're at ~4:00.**

---

## STEP 8 — Design answer (2:00)

### Part 1 — What makes a tool popular

> Devin is number one with **46 upvotes**. Midjourney, which we upvoted earlier, has **341** — and it's not even in the top five. That's not a bug. That's the whole idea.

> In Toolbeam, popular means **upvotes, discounted by how long the tool has had to collect them**.

> Because think about what raw upvote count actually measures. Whatever launched first has had the most time to gather votes. So a plain leaderboard doesn't really rank quality — it ranks *age*. It locks in on day one and never moves again. And that is precisely the problem this whole directory exists to solve: good new tools being invisible underneath the famous ones.

> So fifty upvotes last week beats sixty upvotes spread over two years. The second number is bigger and the weaker signal.

### Part 2 — How it's stored

> Storage is two layers — and the interesting bit is what I *don't* store.

> **Layer one: the votes themselves.** Every single upvote is its own record — who voted, which tool, and when. That's the source of truth, and it's what that uniqueness rule from earlier protects.

> **Layer two: a running total on each tool.** I keep a counter that goes up by one each time. Strictly speaking that's duplicate information, but it means ranking never has to count through thousands of individual vote records just to sort a list — it reads one number.

> **And what I never store is the score itself.** That's the deliberate part. The score changes every second, for no reason other than tools getting older. If I saved it to the database, it'd be out of date the instant I wrote it — and keeping it accurate would mean a background job rewriting every tool in the system, forever. So I don't.

### Part 3 — How it's calculated and returned

> Instead it's worked out **at the moment you ask**, by MongoDB itself, inside the database.

> The formula is: **upvote count, divided by age in hours plus two, raised to the power one point five.**

*(say that slowly, then pause)*

> Three pieces there, quickly. The **age** is measured against the server's clock at the instant of the request — so it's always current and there's nothing to refresh. The **one point five** controls how fast old things fade; it's the same constant Hacker News uses, steep enough that something new can break through, gentle enough that a genuinely great tool doesn't disappear in a week. And the **plus two** just stops the maths exploding for a tool that's two minutes old.

> One last detail I'd defend: I don't add anything to the top of that fraction. A tool with zero upvotes scores exactly zero and sinks. If I'd smoothed that — given everything a free point — then brand-new tools would float up on newness alone, and Popular would slowly turn into a second copy of Recent.

> And the response includes the score and the age for every tool, so you don't have to take my word for the ordering — you can check the arithmetic yourself.

✅ **30 points**

---

## STEP 9 — Close (0:15)

**Switch tab to `toolbeam.onrender.com/docs`**

> It's deployed and live, and these docs are generated from the same rules that validate the real requests — so the documentation can't drift out of sync with the API.

> That's Toolbeam. Thanks for watching.

✅ **10 points**

---

## If asked a follow-up

**On the weekly view:**

> There's also a week window, which runs a different calculation — it ranks by votes cast *inside* that week with no age decay, because the window already handles recency.

**On the trade-off:**

> Recording the vote and bumping the counter are two separate writes, not one transaction. If the server died between them the counter could end up one low. I chose that deliberately — a full transaction on every upvote isn't worth the latency, and the worst case is a slightly low number, never a lost or duplicated vote. There's a script that recounts from the vote records and repairs it.

---

## If something breaks

**Request hangs ~30s** → cold start, keep talking, it lands

**409 on the first upvote** → already used it in a rehearsal; upvote a different tool, or lean in: "that's the guarantee working"

**401 anywhere** → re-send `0. Log in`, carry on

**Related list full of "Toolbeam Scout" copies** → stop, run `npm run seed`, restart the take

---

## Three delivery habits

1. **Explain the why before the what.** Every step opens with the problem, then the solution.
2. **Say the formula slowly, in words.** Then pause.
3. **Let 46 beating 341 do the work.** It looks like a mistake for two seconds — then you explain it, and it proves the design was intentional.
