// Path: agents/src/adapters/embeddings.ts
//
// Minimal embeddings adapter for AI Hire AI / FairSignal
// - Stub-first for demo reliability
// - Real-mode skeleton for Nova embeddings via Bedrock
//
// What this file provides:
// 1) embedTextBatch(...)         -> create vectors from text items
// 2) embedQuery(...)             -> create a query vector
// 3) semanticSearchTopK(...)     -> rank corpus by similarity
// 4) cosineSimilarity(...)       -> reusable similarity utility
//
// Notes:
// - Stub mode uses deterministic fake vectors so your demo is stable.
// - Real mode is intentionally lightweight and throws a clear error if not implemented.
// - Keep this adapter generic so both candidate-side and recruiter-side features can reuse it.

export type EmbeddingsMode = "stub" | "real";

export interface EmbeddingsConfig {
  mode: EmbeddingsMode;
  region?: string;               // e.g. "us-east-1"
  modelId?: string;              // Nova embeddings model id (fill later)
  dimensions?: number;           // used in stub mode, default 24
}

export interface EmbedRequest {
  id: string;
  text: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface EmbedVector {
  id: string;
  vector: number[];
  metadata?: Record<string, string | number | boolean>;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata?: Record<string, string | number | boolean>;
}

// ---------------------------
// Helpers
// ---------------------------
function clip(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function safeLower(s: string): string {
  return normalizeWhitespace(s).toLowerCase();
}

function l2Norm(vec: number[]): number {
  const sumSq = vec.reduce((sum, v) => sum + v * v, 0);
  return Math.sqrt(sumSq) || 1;
}

function normalizeVector(vec: number[]): number[] {
  const norm = l2Norm(vec);
  return vec.map((v) => v / norm);
}

/**
 * Deterministic stub vectorizer.
 * Creates stable pseudo-embeddings based on character distribution + token hints.
 * This is NOT semantically accurate, but it's good enough for a consistent demo.
 */
function stubVector(text: string, dims = 24): number[] {
  const t = safeLower(text);
  const v = new Array(dims).fill(0);

  // Character signal
  for (let i = 0; i < t.length; i++) {
    const code = t.charCodeAt(i);
    const idx = i % dims;
    v[idx] += (code % 41) / 41;
  }

  // Very light token weighting for demo realism
  const tokenBoosts: Record<string, number> = {
    python: 1.6,
    nlp: 1.7,
    "machine learning": 1.8,
    pandas: 1.4,
    sql: 1.4,
    aws: 1.5,
    docker: 1.4,
    react: 1.5,
    javascript: 1.5,
    typescript: 1.5,
    api: 1.3,
    "data science": 1.7,
    "software engineer": 1.7,
    "remote": 1.2,
  };

  for (const [term, boost] of Object.entries(tokenBoosts)) {
    if (t.includes(term)) {
      // map term deterministically to one dimension
      const idx = Math.abs(hashString(term)) % dims;
      v[idx] += boost;
    }
  }

  return normalizeVector(v);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Cosine similarity for normalized or non-normalized vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let aSq = 0;
  let bSq = 0;

  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    aSq += a[i] * a[i];
    bSq += b[i] * b[i];
  }

  const denom = (Math.sqrt(aSq) || 1) * (Math.sqrt(bSq) || 1);
  return clip(dot / denom, -1, 1);
}

// ---------------------------
// Main embedding functions
// ---------------------------

/**
 * Embed a batch of text items.
 */
export async function embedTextBatch(
  cfg: EmbeddingsConfig,
  items: EmbedRequest[]
): Promise<EmbedVector[]> {
  const dims = cfg.dimensions ?? 24;

  if (cfg.mode === "stub") {
    return items.map((it) => ({
      id: it.id,
      vector: stubVector(it.text, dims),
      metadata: it.metadata,
    }));
  }

  // REAL MODE (skeleton)
  // You can later implement this with @aws-sdk/client-bedrock-runtime
  // and invoke the Nova embeddings model. Keep the same return shape.
  //
  // Example later:
  // - create BedrockRuntimeClient
  // - for each input text, call embeddings model
  // - parse output embedding array
  //
  throw new Error("embedTextBatch real mode not implemented yet.");
}

/**
 * Embed a single query string.
 */
export async function embedQuery(
  cfg: EmbeddingsConfig,
  query: string
): Promise<number[]> {
  const [first] = await embedTextBatch(cfg, [
    {
      id: "query",
      text: query,
    },
  ]);
  return first.vector;
}

/**
 * In-memory semantic search over a corpus of vectors.
 * Great for demo data and local ranking.
 */
export function semanticSearchTopK(args: {
  queryVector: number[];
  corpus: EmbedVector[];
  k: number;
}): SearchResult[] {
  const scored: SearchResult[] = args.corpus.map((item) => ({
    id: item.id,
    score: cosineSimilarity(args.queryVector, item.vector),
    metadata: item.metadata,
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, args.k));
}

/**
 * Convenience helper: directly rank raw text items by a text query.
 * This is handy for recruiter "Brain Search" demos.
 */
export async function searchTextsByQuery(args: {
  cfg: EmbeddingsConfig;
  query: string;
  items: EmbedRequest[];
  k: number;
}): Promise<SearchResult[]> {
  const queryVector = await embedQuery(args.cfg, args.query);
  const corpus = await embedTextBatch(args.cfg, args.items);
  return semanticSearchTopK({
    queryVector,
    corpus,
    k: args.k,
  });
}

/**
 * Convenience helper: "more like this"
 * Given one item id in the corpus, return the top similar others.
 */
export function moreLikeThis(args: {
  sourceId: string;
  corpus: EmbedVector[];
  k: number;
}): SearchResult[] {
  const source = args.corpus.find((c) => c.id === args.sourceId);
  if (!source) return [];

  const scored: SearchResult[] = args.corpus
    .filter((c) => c.id !== args.sourceId)
    .map((item) => ({
      id: item.id,
      score: cosineSimilarity(source.vector, item.vector),
      metadata: item.metadata,
    }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, args.k));
}