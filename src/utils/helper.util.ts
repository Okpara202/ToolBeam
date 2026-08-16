import argon2 from 'argon2';

// Pinned explicitly so a future argon2 default change cannot silently weaken
// every password hash the directory has stored.
const PASSWORD_HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
};

export const hashPassword = (password: string) => argon2.hash(password, PASSWORD_HASH_OPTIONS);

export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password);

/** Escapes regex metacharacters so free-text search can safely build a RegExp. */
export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Words carrying no signal about what a tool *does*.
 *
 * Beyond ordinary English stopwords this deliberately drops directory-generic
 * vocabulary — "ai", "tool", "platform", "powered" — because those appear in
 * almost every description here. Left in, they would make every tool look
 * related to every other tool and flatten the relatedness score to noise.
 */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'was', 'were',
  'has', 'have', 'had', 'can', 'will', 'into', 'out', 'its', 'their', 'them', 'they', 'his',
  'her', 'our', 'all', 'any', 'not', 'but', 'use', 'uses', 'used', 'using', 'get', 'gets',
  'make', 'makes', 'made', 'more', 'most', 'other', 'than', 'then', 'also', 'just', 'like',
  'over', 'under', 'about', 'across', 'without', 'within', 'between', 'through', 'each',
  'every', 'own', 'via', 'per', 'onto', 'upon', 'while', 'when', 'where', 'what', 'which',
  'who', 'whom', 'how', 'why', 'been', 'being', 'does', 'did', 'doing', 'such', 'both',
  // directory-generic — present in nearly every entry, so worthless as a signal
  'ai', 'tool', 'tools', 'app', 'apps', 'application', 'platform', 'powered', 'software',
  'service', 'solution', 'product', 'online', 'best', 'new', 'free', 'help', 'helps',
  'lets', 'allow', 'allows', 'enable', 'enables', 'built', 'build', 'based', 'simple',
  'easy', 'fast', 'one', 'way', 'ways',
]);

const MAX_KEYWORDS = 24;
const MIN_KEYWORD_LENGTH = 3;

/**
 * Derives the searchable keyword set for a tool from its name and description.
 *
 * Storing these as a plain array is what lets the relatedness pipeline treat
 * free-text similarity as a `$setIntersection` — exactly the same cheap array
 * operation as tag overlap — instead of needing a text index and a second query.
 * Always derived server-side on write; never accepted from a client, which
 * would otherwise let a submitter keyword-stuff their way into every result.
 */
export const extractKeywords = (...sources: string[]): string[] => {
  const seen = new Set<string>();

  for (const source of sources) {
    if (!source) continue;

    const tokens = source
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/[\s-]+/);

    for (const token of tokens) {
      if (token.length < MIN_KEYWORD_LENGTH) continue;
      if (STOPWORDS.has(token)) continue;
      if (/^\d+$/.test(token)) continue;

      seen.add(token);
      if (seen.size >= MAX_KEYWORDS) return [...seen];
    }
  }

  return [...seen];
};

const MAX_TAGS = 10;

/** Lowercases, trims, de-duplicates and caps user-supplied tags. */
export const normalizeTags = (tags: string[] = []): string[] => {
  const seen = new Set<string>();

  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (normalized) seen.add(normalized);
    if (seen.size >= MAX_TAGS) break;
  }

  return [...seen];
};

/**
 * Collapses a URL to a comparison key for duplicate detection: protocol,
 * "www.", trailing slashes and casing are all noise, so
 * `https://WWW.Midjourney.com/` and `http://midjourney.com` are one tool.
 * The original link is stored untouched for display — only the key is indexed.
 */
export const normalizeLink = (link: string): string =>
  link
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
