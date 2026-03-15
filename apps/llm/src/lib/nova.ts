/**
 * Amazon Nova AI Client
 *
 * Wrapper around AWS Bedrock Runtime SDK for Amazon Nova Lite.
 * Mirrors the API shape of gemini.ts — generateNovaText / generateNovaJSON.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

let client: BedrockRuntimeClient | null = null;

const MODEL_ID = process.env.NOVA_MODEL_ID ?? "amazon.nova-lite-v1:0";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_JSON_RETRIES = 3;
const RETRY_BASE_MS = 1000;

// ============================================================================
// Client singleton
// ============================================================================

export function getNovaClient(): BedrockRuntimeClient {
  if (client) return client;

  const region = process.env.AWS_REGION ?? process.env.MODEL_REGION ?? "us-east-1";
  const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK;

  if (bearerToken) {
    // Use bearer token auth (hackathon / short-lived token)
    client = new BedrockRuntimeClient({
      region,
      token: { token: bearerToken },
    });
    console.log("Nova client: using bearer token auth (AWS_BEARER_TOKEN_BEDROCK)");
  } else {
    // Fall back to IAM credentials from env (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
    client = new BedrockRuntimeClient({ region });
    console.log("Nova client: using IAM credential auth");
  }

  return client;
}

// ============================================================================
// Core invocation
// ============================================================================

async function invokeNova(
  prompt: string,
  systemMessage?: string,
): Promise<string> {
  const bedrock = getNovaClient();

  const body = JSON.stringify({
    messages: [{ role: "user", content: [{ text: prompt }] }],
    system: systemMessage ? [{ text: systemMessage }] : undefined,
    inferenceConfig: {
      temperature: DEFAULT_TEMPERATURE,
      max_new_tokens: DEFAULT_MAX_TOKENS,
    },
  });

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: new TextEncoder().encode(body),
  });

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Nova returns: { output: { message: { content: [{ text: "..." }] } } }
  const text = responseBody?.output?.message?.content?.[0]?.text;

  if (!text) {
    throw new Error(
      `Empty response from Nova. Raw: ${JSON.stringify(responseBody).slice(0, 500)}`,
    );
  }

  return text;
}

// ============================================================================
// Text generation
// ============================================================================

/**
 * Send a prompt to Amazon Nova and return the raw text response.
 */
export async function generateNovaText(prompt: string): Promise<string> {
  return invokeNova(prompt);
}

// ============================================================================
// JSON generation
// ============================================================================

const JSON_SYSTEM_MESSAGE =
  "You are a JSON-only API. Return valid JSON with no markdown formatting, no backticks, no explanation. Only output the JSON object.";

/**
 * Send a prompt and parse the response as JSON.
 * Strips markdown fences if the model wraps the output.
 */
export async function generateNovaJSON<T = unknown>(
  prompt: string,
): Promise<T> {
  const raw = await invokeNova(prompt, JSON_SYSTEM_MESSAGE);
  return parseJsonResponse<T>(raw);
}

/**
 * Generate JSON with retry logic and exponential backoff.
 */
export async function generateNovaJSONWithRetry<T = unknown>(
  prompt: string,
  retries = DEFAULT_JSON_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const adjustedPrompt =
        attempt === 0 ? prompt : buildRetryPrompt(prompt, lastError, attempt);

      const raw = await invokeNova(adjustedPrompt, JSON_SYSTEM_MESSAGE);
      return parseJsonResponse<T>(raw);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await sleep(RETRY_BASE_MS * (attempt + 1));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Shared helpers (same logic as gemini.ts)
// ============================================================================

/** Strip markdown fences and parse JSON */
function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const extracted = extractJsonCandidate(cleaned);

  try {
    return JSON.parse(extracted) as T;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new SyntaxError(
      `Invalid JSON response from Nova: ${message}. Raw length=${cleaned.length}`,
    );
  }
}

function extractJsonCandidate(text: string): string {
  const objectStart = text.indexOf("{");
  const arrayStart = text.indexOf("[");

  let start = -1;
  if (objectStart === -1) start = arrayStart;
  else if (arrayStart === -1) start = objectStart;
  else start = Math.min(objectStart, arrayStart);

  if (start === -1) return text;

  const objectEnd = text.lastIndexOf("}");
  const arrayEnd = text.lastIndexOf("]");
  const end = Math.max(objectEnd, arrayEnd);

  if (end <= start) return text.slice(start);

  return text.slice(start, end + 1).trim();
}

function buildRetryPrompt(
  prompt: string,
  lastError: Error | null,
  attempt: number,
): string {
  const reason = lastError?.message ?? "Invalid JSON";

  return `${prompt}\n\nRETRY #${attempt}: The previous output could not be parsed as JSON (${reason}). Regenerate the FULL response from scratch as ONE complete valid JSON object. Do not include markdown fences or commentary.`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
