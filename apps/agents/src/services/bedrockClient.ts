// Path: apps/llm/agents/src/services/bedrockClient.ts
//
// Production-style Bedrock service wrapper for AI Hire AI / FairSignal
// Adds:
// - retries with exponential backoff
// - latency + token-ish metrics
// - guardrail support
// - model / inference-profile selection
// - graceful fallback to stub text
//
// Depends on:
// - agents/src/adapters/bedrock.ts
//
// Recommended env:
//   AWS_REGION=us-east-1
//   USE_REAL_BEDROCK=true
//   BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
//   BEDROCK_INFERENCE_PROFILE_ID=...
//   BEDROCK_GUARDRAIL_ID=...
//   BEDROCK_GUARDRAIL_VERSION=...
//
// Notes:
// - This file prefers Converse API for real text generation.
// - If Converse fails, it falls back to the existing adapter's bedrockGenerateText.
// - Stub mode still works even if AWS SDK packages are missing.
import {
  bedrockGenerateText,
  type BedrockConfig,
  type BedrockTextRequest,
  type BedrockTextResponse,
} from "../adapters/bedrock";

export interface BedrockClientMetrics {
  feature: string;
  provider: "stub" | "bedrock-converse" | "bedrock-invoke";
  modelId: string;
  inferenceProfileId?: string;
  latencyMs: number;
  attempts: number;
  usedFallback: boolean;
  degraded: boolean;
  inputTokensEstimated: number;
  outputTokensEstimated: number;
  timestampISO: string;
  requestId?: string;
  errorMessage?: string;
}

export interface BedrockGuardrailConfig {
  enabled?: boolean;
  guardrailId?: string;
  guardrailVersion?: string;
}

export interface BedrockFeatureRequest {
  feature: string;
  system?: string;
  prompt: string;
  schemaHint?: string;
  config?: BedrockConfig;
  guardrail?: BedrockGuardrailConfig;
  metadata?: Record<string, string | number | boolean>;
}

export interface BedrockFeatureResponse extends BedrockTextResponse {
  provider: "stub" | "bedrock-converse" | "bedrock-invoke";
  degraded: boolean;
  usedFallback: boolean;
  metrics: BedrockClientMetrics;
}

export interface BedrockStructuredResult<T> extends BedrockFeatureResponse {
  parsed: T | null;
  parseError?: string;
}

export interface BedrockServiceOptions {
  maxAttempts?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  timeoutMs?: number;
  preferConverse?: boolean;
  logMetrics?: boolean;
}

type JsonLike = Record<string, unknown>;

function truthy(v?: string): boolean {
  return v === "1" || v === "true" || v === "TRUE" || v === "yes" || v === "on";
}

function nowISO() {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text || "").trim().length / 4));
}

function cleanText(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function clip(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function resolveMode(cfg?: BedrockConfig): "stub" | "real" {
  if (cfg?.mode) return cfg.mode;
  return truthy(process.env.USE_REAL_BEDROCK) ? "real" : "stub";
}

function resolveRegion(cfg?: BedrockConfig): string {
  return cfg?.region ?? process.env.AWS_REGION ?? "us-east-1";
}

function resolveModelId(cfg?: BedrockConfig): string {
  return (
    process.env.BEDROCK_INFERENCE_PROFILE_ID ||
    cfg?.modelId ||
    process.env.BEDROCK_MODEL_ID ||
    "amazon.nova-lite-v1:0"
  );
}

function resolveBaseModelId(cfg?: BedrockConfig): string {
  return cfg?.modelId ?? process.env.BEDROCK_MODEL_ID ?? "amazon.nova-lite-v1:0";
}

function resolveMaxTokens(cfg?: BedrockConfig): number {
  return cfg?.maxTokens ?? 400;
}

function resolveTemperature(cfg?: BedrockConfig): number {
  return cfg?.temperature ?? 0.2;
}

function defaultOptions(opts?: BedrockServiceOptions): Required<BedrockServiceOptions> {
  return {
    maxAttempts: opts?.maxAttempts ?? 3,
    initialBackoffMs: opts?.initialBackoffMs ?? 600,
    maxBackoffMs: opts?.maxBackoffMs ?? 4000,
    timeoutMs: opts?.timeoutMs ?? 25000,
    preferConverse: opts?.preferConverse ?? true,
    logMetrics: opts?.logMetrics ?? true,
  };
}

function computeBackoff(attempt: number, initialMs: number, maxMs: number): number {
  const raw = initialMs * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 150);
  return Math.min(maxMs, raw + jitter);
}

function isRetryableErrorMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("throttl") ||
    m.includes("timeout") ||
    m.includes("temporar") ||
    m.includes("internal") ||
    m.includes("too many requests") ||
    m.includes("service unavailable")
  );
}

function extractTextFromConverseResponse(parsed: any): string {
  if (!parsed) return "";

  if (Array.isArray(parsed?.output?.message?.content)) {
    const textBlock = parsed.output.message.content.find(
      (c: any) => typeof c?.text === "string"
    );
    if (textBlock?.text) return cleanText(textBlock.text);
  }

  if (Array.isArray(parsed?.content)) {
    const textBlock = parsed.content.find((c: any) => typeof c?.text === "string");
    if (textBlock?.text) return cleanText(textBlock.text);
  }

  if (typeof parsed?.outputText === "string") return cleanText(parsed.outputText);
  if (typeof parsed?.text === "string") return cleanText(parsed.text);
  if (typeof parsed === "string") return cleanText(parsed);

  return cleanText(JSON.stringify(parsed));
}

function extractRequestId(meta: any): string | undefined {
  return meta?.requestId || meta?.$metadata?.requestId;
}

function buildPrompt(req: BedrockFeatureRequest): BedrockTextRequest {
  const schemaHint = req.schemaHint ? `\n\nOutput format:\n${req.schemaHint}` : "";
  return {
    system: req.system,
    prompt: `${req.prompt}${schemaHint}`,
  };
}

function safeParseJson<T>(text: string): { parsed: T | null; parseError?: string } {
  const cleaned = (text || "").trim();
  if (!cleaned) return { parsed: null, parseError: "Empty model output" };

  try {
    return { parsed: JSON.parse(cleaned) as T };
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return { parsed: JSON.parse(match[0]) as T };
      } catch (err) {
        return {
          parsed: null,
          parseError:
            err instanceof Error ? err.message : "JSON extraction parse failed",
        };
      }
    }

    return { parsed: null, parseError: "No valid JSON found in model output" };
  }
}

function logMetricsIfEnabled(metrics: BedrockClientMetrics, enabled: boolean) {
  if (!enabled) return;

  console.log(
    JSON.stringify({
      type: "bedrock_metrics",
      ...metrics,
    })
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Bedrock request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function loadBedrockRuntime(region: string) {
  const aws = await import("@aws-sdk/client-bedrock-runtime");
  const client = new aws.BedrockRuntimeClient({ region });
  return { aws, client };
}

function buildGuardrailConfig(input?: BedrockGuardrailConfig) {
  const envEnabled =
    truthy(process.env.BEDROCK_GUARDRAILS_ENABLED) ||
    !!process.env.BEDROCK_GUARDRAIL_ID;

  const enabled = input?.enabled ?? envEnabled;

  const guardrailId =
    input?.guardrailId ?? process.env.BEDROCK_GUARDRAIL_ID;

  const guardrailVersion =
    input?.guardrailVersion ?? process.env.BEDROCK_GUARDRAIL_VERSION;

  if (!enabled || !guardrailId || !guardrailVersion) return undefined;

  return {
    guardrailIdentifier: guardrailId,
    guardrailVersion,
    trace: "disabled" as const,
  };
}

async function converseReal(
  req: BedrockFeatureRequest,
  opts: Required<BedrockServiceOptions>
): Promise<BedrockFeatureResponse> {
  const mode = resolveMode(req.config);
  const region = resolveRegion(req.config);
  const modelIdOrProfile = resolveModelId(req.config);
  const baseModelId = resolveBaseModelId(req.config);
  const maxTokens = resolveMaxTokens(req.config);
  const temperature = resolveTemperature(req.config);
  const prompt = buildPrompt(req);

  if (mode === "stub") {
    const start = Date.now();
    const fallback = await bedrockGenerateText(
      {
        mode: "stub",
        region,
        modelId: baseModelId,
        maxTokens,
        temperature,
      },
      prompt
    );

    const metrics: BedrockClientMetrics = {
      feature: req.feature,
      provider: "stub",
      modelId: baseModelId,
      inferenceProfileId:
        process.env.BEDROCK_INFERENCE_PROFILE_ID || undefined,
      latencyMs: Date.now() - start,
      attempts: 1,
      usedFallback: false,
      degraded: false,
      inputTokensEstimated: estimateTokens(
        (prompt.system ?? "") + "\n" + prompt.prompt
      ),
      outputTokensEstimated: estimateTokens(fallback.text),
      timestampISO: nowISO(),
    };

    logMetricsIfEnabled(metrics, opts.logMetrics);

    return {
      ...fallback,
      provider: "stub",
      degraded: false,
      usedFallback: false,
      metrics,
    };
  }

  let lastError: Error | null = null;
  const startOverall = Date.now();

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const { aws, client } = await loadBedrockRuntime(region);

      const commandInput: any = {
        modelId: modelIdOrProfile,
        messages: [
          {
            role: "user",
            content: [{ text: prompt.prompt }],
          },
        ],
        inferenceConfig: {
          maxTokens,
          temperature,
        },
      };

      if (prompt.system) {
        commandInput.system = [{ text: prompt.system }];
      }

      const guardrailConfig = buildGuardrailConfig(req.guardrail);
      if (guardrailConfig) {
        commandInput.guardrailConfig = guardrailConfig;
      }

      const response = await withTimeout(
        client.send(new aws.ConverseCommand(commandInput)),
        opts.timeoutMs
      );

      const text = extractTextFromConverseResponse(response);

      const usage = response.usage
        ? {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
          }
        : {
            inputTokens: estimateTokens(
              (prompt.system ?? "") + "\n" + prompt.prompt
            ),
            outputTokens: estimateTokens(text),
          };

      const metrics: BedrockClientMetrics = {
        feature: req.feature,
        provider: "bedrock-converse",
        modelId: baseModelId,
        inferenceProfileId:
          process.env.BEDROCK_INFERENCE_PROFILE_ID || undefined,
        latencyMs: Date.now() - startOverall,
        attempts: attempt,
        usedFallback: false,
        degraded: false,
        inputTokensEstimated: usage.inputTokens ?? 0,
        outputTokensEstimated: usage.outputTokens ?? 0,
        timestampISO: nowISO(),
        requestId: extractRequestId(response),
      };

      logMetricsIfEnabled(metrics, opts.logMetrics);

      return {
        text,
        usage,
        modelId: modelIdOrProfile,
        raw: response,
        provider: "bedrock-converse",
        degraded: false,
        usedFallback: false,
        metrics,
      };
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error("Unknown Bedrock converse error");

      lastError = err;

      const shouldRetry =
        attempt < opts.maxAttempts &&
        isRetryableErrorMessage(err.message);

      if (shouldRetry) {
        await sleep(
          computeBackoff(attempt, opts.initialBackoffMs, opts.maxBackoffMs)
        );
        continue;
      }

      break;
    }
  }

  // Fallback to invoke-based adapter (real mode)
  try {
    const promptReq = buildPrompt(req);

    const fallback = await bedrockGenerateText(
      {
        mode: "real",
        region,
        modelId: baseModelId,
        maxTokens,
        temperature,
      },
      promptReq
    );

    const metrics: BedrockClientMetrics = {
      feature: req.feature,
      provider: "bedrock-invoke",
      modelId: baseModelId,
      inferenceProfileId:
        process.env.BEDROCK_INFERENCE_PROFILE_ID || undefined,
      latencyMs: Date.now() - startOverall,
      attempts: opts.maxAttempts,
      usedFallback: true,
      degraded: true,
      inputTokensEstimated:
        fallback.usage?.inputTokens ??
        estimateTokens((promptReq.system ?? "") + "\n" + promptReq.prompt),
      outputTokensEstimated:
        fallback.usage?.outputTokens ?? estimateTokens(fallback.text),
      timestampISO: nowISO(),
      errorMessage: lastError?.message,
    };

    logMetricsIfEnabled(metrics, opts.logMetrics);

    return {
      ...fallback,
      provider: "bedrock-invoke",
      degraded: true,
      usedFallback: true,
      metrics,
    };
  } catch (fallbackError) {
    const fallbackStub = await bedrockGenerateText(
      {
        mode: "stub",
        region,
        modelId: baseModelId,
        maxTokens,
        temperature,
      },
      buildPrompt(req)
    );

    const metrics: BedrockClientMetrics = {
      feature: req.feature,
      provider: "stub",
      modelId: baseModelId,
      inferenceProfileId:
        process.env.BEDROCK_INFERENCE_PROFILE_ID || undefined,
      latencyMs: Date.now() - startOverall,
      attempts: opts.maxAttempts,
      usedFallback: true,
      degraded: true,
      inputTokensEstimated:
        fallbackStub.usage?.inputTokens ??
        estimateTokens((req.system ?? "") + "\n" + req.prompt),
      outputTokensEstimated:
        fallbackStub.usage?.outputTokens ??
        estimateTokens(fallbackStub.text),
      timestampISO: nowISO(),
      errorMessage:
        lastError?.message ||
        (fallbackError instanceof Error
          ? fallbackError.message
          : "Unknown fallback error"),
    };

    logMetricsIfEnabled(metrics, opts.logMetrics);

    return {
      ...fallbackStub,
      provider: "stub",
      degraded: true,
      usedFallback: true,
      metrics,
    };
  }
}

// ---------------------------
// Public service API
// ---------------------------

export async function generateTextWithBedrock(
  req: BedrockFeatureRequest,
  opts?: BedrockServiceOptions
): Promise<BedrockFeatureResponse> {
  const resolved = defaultOptions(opts);

  if (resolved.preferConverse) {
    return converseReal(req, resolved);
  }

  const start = Date.now();
  const prompt = buildPrompt(req);
  const mode = resolveMode(req.config);
  const region = resolveRegion(req.config);
  const modelId = resolveBaseModelId(req.config);
  const maxTokens = resolveMaxTokens(req.config);
  const temperature = resolveTemperature(req.config);

  try {
    const res = await bedrockGenerateText(
      {
        mode,
        region,
        modelId,
        maxTokens,
        temperature,
      },
      prompt
    );

    const provider = mode === "real" ? "bedrock-invoke" : "stub";

    const metrics: BedrockClientMetrics = {
      feature: req.feature,
      provider,
      modelId,
      inferenceProfileId:
        process.env.BEDROCK_INFERENCE_PROFILE_ID || undefined,
      latencyMs: Date.now() - start,
      attempts: 1,
      usedFallback: false,
      degraded: false,
      inputTokensEstimated:
        res.usage?.inputTokens ??
        estimateTokens((prompt.system ?? "") + "\n" + prompt.prompt),
      outputTokensEstimated:
        res.usage?.outputTokens ?? estimateTokens(res.text),
      timestampISO: nowISO(),
    };

    logMetricsIfEnabled(metrics, resolved.logMetrics);

    return {
      ...res,
      provider,
      degraded: false,
      usedFallback: false,
      metrics,
    };
  } catch (error) {
    const fallback = await bedrockGenerateText(
      {
        mode: "stub",
        region,
        modelId,
        maxTokens,
        temperature,
      },
      prompt
    );

    const metrics: BedrockClientMetrics = {
      feature: req.feature,
      provider: "stub",
      modelId,
      inferenceProfileId:
        process.env.BEDROCK_INFERENCE_PROFILE_ID || undefined,
      latencyMs: Date.now() - start,
      attempts: 1,
      usedFallback: true,
      degraded: true,
      inputTokensEstimated:
        fallback.usage?.inputTokens ??
        estimateTokens((prompt.system ?? "") + "\n" + prompt.prompt),
      outputTokensEstimated:
        fallback.usage?.outputTokens ?? estimateTokens(fallback.text),
      timestampISO: nowISO(),
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    };

    logMetricsIfEnabled(metrics, resolved.logMetrics);

    return {
      ...fallback,
      provider: "stub",
      degraded: true,
      usedFallback: true,
      metrics,
    };
  }
}

export async function generateStructuredJsonWithBedrock<T extends JsonLike>(
  req: BedrockFeatureRequest,
  opts?: BedrockServiceOptions
): Promise<BedrockStructuredResult<T>> {
  const response = await generateTextWithBedrock(req, opts);
  const parsed = safeParseJson<T>(response.text);

  return {
    ...response,
    parsed: parsed.parsed,
    parseError: parsed.parseError,
  };
}

export async function summarizeWithBedrock(args: {
  feature?: string;
  text: string;
  config?: BedrockConfig;
  guardrail?: BedrockGuardrailConfig;
  maxSentences?: number;
  opts?: BedrockServiceOptions;
}): Promise<BedrockFeatureResponse> {
  const maxSentences = clip(args.maxSentences ?? 2, 1, 5);

  return generateTextWithBedrock(
    {
      feature: args.feature ?? "summary",
      config: args.config,
      guardrail: args.guardrail,
      system: `You are a concise assistant. Return a factual summary in no more than ${maxSentences} sentences.`,
      prompt: args.text,
    },
    args.opts
  );
}