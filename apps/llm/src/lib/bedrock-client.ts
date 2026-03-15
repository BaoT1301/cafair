import type {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

export type BedrockMode = "stub" | "real";
export type BedrockProvider = "stub" | "bedrock-converse" | "bedrock-invoke";

export interface BedrockConfig {
  mode?: BedrockMode;
  region?: string;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface BedrockTextUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface BedrockClientMetrics {
  feature: string;
  provider: BedrockProvider;
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

export interface BedrockFeatureRequest {
  feature: string;
  system?: string;
  prompt: string;
  schemaHint?: string;
  config?: BedrockConfig;
}

export interface BedrockFeatureResponse {
  text: string;
  usage?: BedrockTextUsage;
  modelId?: string;
  raw?: unknown;
  provider: BedrockProvider;
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

function truthy(value?: string): boolean {
  return (
    value === "1" ||
    value === "true" ||
    value === "TRUE" ||
    value === "yes" ||
    value === "on"
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

function resolveMode(config?: BedrockConfig): BedrockMode {
  if (config?.mode) return config.mode;
  return truthy(process.env.USE_REAL_BEDROCK) ? "real" : "stub";
}

function resolveRegion(config?: BedrockConfig): string {
  return config?.region ?? process.env.AWS_REGION ?? "us-east-1";
}

function resolveModelId(config?: BedrockConfig): string {
  return (
    process.env.BEDROCK_INFERENCE_PROFILE_ID ||
    config?.modelId ||
    process.env.BEDROCK_MODEL_ID ||
    process.env.NOVA_MODEL_ID ||
    "amazon.nova-lite-v1:0"
  );
}

function resolveBaseModelId(config?: BedrockConfig): string {
  return (
    config?.modelId ??
    process.env.BEDROCK_MODEL_ID ??
    process.env.NOVA_MODEL_ID ??
    "amazon.nova-lite-v1:0"
  );
}

function resolveMaxTokens(config?: BedrockConfig): number {
  return config?.maxTokens ?? 400;
}

function resolveTemperature(config?: BedrockConfig): number {
  return config?.temperature ?? 0.2;
}

function defaultOptions(
  options?: BedrockServiceOptions,
): Required<BedrockServiceOptions> {
  return {
    maxAttempts: options?.maxAttempts ?? 3,
    initialBackoffMs: options?.initialBackoffMs ?? 600,
    maxBackoffMs: options?.maxBackoffMs ?? 4000,
    timeoutMs: options?.timeoutMs ?? 25000,
    preferConverse: options?.preferConverse ?? true,
    logMetrics: options?.logMetrics ?? true,
  };
}

function computeBackoff(
  attempt: number,
  initialBackoffMs: number,
  maxBackoffMs: number,
): number {
  const raw = initialBackoffMs * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 150);
  return Math.min(maxBackoffMs, raw + jitter);
}

function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("throttl") ||
    message.includes("timeout") ||
    message.includes("temporar") ||
    message.includes("internal") ||
    message.includes("too many requests") ||
    message.includes("service unavailable")
  );
}

function buildPrompt(req: BedrockFeatureRequest): {
  system?: string;
  prompt: string;
} {
  const schemaHint = req.schemaHint ? `\n\nOutput format:\n${req.schemaHint}` : "";
  return {
    system: req.system,
    prompt: `${req.prompt}${schemaHint}`,
  };
}

function safeParseJson<T>(
  text: string,
): { parsed: T | null; parseError?: string } {
  const cleaned = text.trim();

  if (!cleaned) {
    return { parsed: null, parseError: "Empty model output" };
  }

  try {
    return { parsed: JSON.parse(cleaned) as T };
  } catch {
    const extracted = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!extracted) {
      return { parsed: null, parseError: "No valid JSON found in model output" };
    }

    try {
      return { parsed: JSON.parse(extracted[0]) as T };
    } catch (error) {
      return {
        parsed: null,
        parseError:
          error instanceof Error
            ? error.message
            : "JSON extraction parse failed",
      };
    }
  }
}

function logMetrics(metrics: BedrockClientMetrics, enabled: boolean): void {
  if (!enabled) return;

  console.log(
    JSON.stringify({
      type: "bedrock_metrics",
      ...metrics,
    }),
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

async function loadBedrockRuntime(region: string): Promise<{
  aws: {
    ConverseCommand: typeof ConverseCommand;
    InvokeModelCommand: typeof InvokeModelCommand;
  };
  client: BedrockRuntimeClient;
}> {
  const aws = await import("@aws-sdk/client-bedrock-runtime");
  const client = new aws.BedrockRuntimeClient({ region });
  return { aws, client };
}

function extractRequestId(value: unknown): string | undefined {
  const meta =
    value && typeof value === "object" ? (value as Record<string, unknown>) : null;

  if (typeof meta?.requestId === "string") return meta.requestId;

  const metadata =
    meta?.$metadata && typeof meta.$metadata === "object"
      ? (meta.$metadata as Record<string, unknown>)
      : null;

  return typeof metadata?.requestId === "string" ? metadata.requestId : undefined;
}

function extractTextFromConverseResponse(value: unknown): string {
  const parsed =
    value && typeof value === "object" ? (value as Record<string, unknown>) : null;

  const output =
    parsed?.output && typeof parsed.output === "object"
      ? (parsed.output as Record<string, unknown>)
      : null;

  const message =
    output?.message && typeof output.message === "object"
      ? (output.message as Record<string, unknown>)
      : null;

  const content = Array.isArray(message?.content)
    ? (message.content as Array<Record<string, unknown>>)
    : Array.isArray(parsed?.content)
      ? (parsed.content as Array<Record<string, unknown>>)
      : [];

  const textBlock = content.find((item) => typeof item?.text === "string");
  if (typeof textBlock?.text === "string") {
    return cleanText(textBlock.text);
  }

  if (typeof parsed?.outputText === "string") return cleanText(parsed.outputText);
  if (typeof parsed?.text === "string") return cleanText(parsed.text);
  if (typeof value === "string") return cleanText(value);

  return cleanText(JSON.stringify(value));
}

function buildStubJson(feature: string): string {
  if (feature === "candidate_score") {
    return JSON.stringify({
      score: 72,
      strengths: ["Relevant experience appears in the resume."],
      concerns: ["Bedrock is in stub mode; use a real provider for production scoring."],
      summary: "Stub candidate score generated because real Bedrock is disabled.",
      recommendation: "SCREEN",
    });
  }

  return JSON.stringify({
    ok: true,
    summary: "Stub Bedrock response generated because real Bedrock is disabled.",
  });
}

function buildMetrics(args: {
  feature: string;
  provider: BedrockProvider;
  modelId: string;
  startMs: number;
  attempts: number;
  usedFallback: boolean;
  degraded: boolean;
  promptText: string;
  outputText: string;
  requestId?: string;
  errorMessage?: string;
  usage?: BedrockTextUsage;
}): BedrockClientMetrics {
  return {
    feature: args.feature,
    provider: args.provider,
    modelId: args.modelId,
    inferenceProfileId: process.env.BEDROCK_INFERENCE_PROFILE_ID || undefined,
    latencyMs: Date.now() - args.startMs,
    attempts: args.attempts,
    usedFallback: args.usedFallback,
    degraded: args.degraded,
    inputTokensEstimated:
      args.usage?.inputTokens ?? estimateTokens(args.promptText),
    outputTokensEstimated:
      args.usage?.outputTokens ?? estimateTokens(args.outputText),
    timestampISO: nowIso(),
    requestId: args.requestId,
    errorMessage: args.errorMessage,
  };
}

async function invokeReal(
  req: BedrockFeatureRequest,
  opts: Required<BedrockServiceOptions>,
  lastError?: Error,
): Promise<BedrockFeatureResponse> {
  const region = resolveRegion(req.config);
  const modelId = resolveBaseModelId(req.config);
  const maxTokens = resolveMaxTokens(req.config);
  const temperature = resolveTemperature(req.config);
  const prompt = buildPrompt(req);
  const startMs = Date.now();

  try {
    const { aws, client } = await loadBedrockRuntime(region);

    const body = JSON.stringify({
      messages: [{ role: "user", content: [{ text: prompt.prompt }] }],
      system: prompt.system ? [{ text: prompt.system }] : undefined,
      inferenceConfig: {
        temperature,
        max_new_tokens: maxTokens,
      },
    });

    const response = await withTimeout(
      client.send(
        new aws.InvokeModelCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: new TextEncoder().encode(body),
        }),
      ),
      opts.timeoutMs,
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const text = extractTextFromConverseResponse(responseBody);
    const metrics = buildMetrics({
      feature: req.feature,
      provider: "bedrock-invoke",
      modelId,
      startMs,
      attempts: opts.maxAttempts,
      usedFallback: true,
      degraded: true,
      promptText: `${prompt.system ?? ""}\n${prompt.prompt}`,
      outputText: text,
      requestId: extractRequestId(response),
      errorMessage: lastError?.message,
    });

    logMetrics(metrics, opts.logMetrics);

    return {
      text,
      modelId,
      raw: responseBody,
      provider: "bedrock-invoke",
      degraded: true,
      usedFallback: true,
      metrics,
    };
  } catch (error) {
    const outputText = buildStubJson(req.feature);
    const metrics = buildMetrics({
      feature: req.feature,
      provider: "stub",
      modelId,
      startMs,
      attempts: opts.maxAttempts,
      usedFallback: true,
      degraded: true,
      promptText: `${prompt.system ?? ""}\n${prompt.prompt}`,
      outputText,
      errorMessage:
        lastError?.message ||
        (error instanceof Error ? error.message : "Unknown Bedrock invoke error"),
    });

    logMetrics(metrics, opts.logMetrics);

    return {
      text: outputText,
      modelId,
      raw: error,
      provider: "stub",
      degraded: true,
      usedFallback: true,
      metrics,
    };
  }
}

async function converseReal(
  req: BedrockFeatureRequest,
  opts: Required<BedrockServiceOptions>,
): Promise<BedrockFeatureResponse> {
  const mode = resolveMode(req.config);
  const region = resolveRegion(req.config);
  const modelIdOrProfile = resolveModelId(req.config);
  const baseModelId = resolveBaseModelId(req.config);
  const maxTokens = resolveMaxTokens(req.config);
  const temperature = resolveTemperature(req.config);
  const prompt = buildPrompt(req);
  const promptText = `${prompt.system ?? ""}\n${prompt.prompt}`;
  const startMs = Date.now();

  if (mode === "stub") {
    const text = buildStubJson(req.feature);
    const metrics = buildMetrics({
      feature: req.feature,
      provider: "stub",
      modelId: baseModelId,
      startMs,
      attempts: 1,
      usedFallback: false,
      degraded: false,
      promptText,
      outputText: text,
    });

    logMetrics(metrics, opts.logMetrics);

    return {
      text,
      modelId: baseModelId,
      provider: "stub",
      degraded: false,
      usedFallback: false,
      metrics,
    };
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
    try {
      const { aws, client } = await loadBedrockRuntime(region);

      const response = await withTimeout(
        client.send(
          new aws.ConverseCommand({
            modelId: modelIdOrProfile,
            messages: [
              {
                role: "user",
                content: [{ text: prompt.prompt }],
              },
            ],
            system: prompt.system ? [{ text: prompt.system }] : undefined,
            inferenceConfig: {
              maxTokens,
              temperature,
            },
          }),
        ),
        opts.timeoutMs,
      );

      const text = extractTextFromConverseResponse(response);
      const usage = response.usage
        ? {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
          }
        : undefined;

      const metrics = buildMetrics({
        feature: req.feature,
        provider: "bedrock-converse",
        modelId: baseModelId,
        startMs,
        attempts: attempt,
        usedFallback: false,
        degraded: false,
        promptText,
        outputText: text,
        requestId: extractRequestId(response),
        usage,
      });

      logMetrics(metrics, opts.logMetrics);

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
      lastError =
        error instanceof Error
          ? error
          : new Error("Unknown Bedrock converse error");

      if (attempt < opts.maxAttempts && isRetryableError(lastError)) {
        await sleep(
          computeBackoff(attempt, opts.initialBackoffMs, opts.maxBackoffMs),
        );
        continue;
      }

      break;
    }
  }

  return invokeReal(req, opts, lastError ?? undefined);
}

export async function generateTextWithBedrock(
  req: BedrockFeatureRequest,
  opts?: BedrockServiceOptions,
): Promise<BedrockFeatureResponse> {
  const resolvedOptions = defaultOptions(opts);

  if (resolvedOptions.preferConverse) {
    return converseReal(req, resolvedOptions);
  }

  return invokeReal(req, resolvedOptions);
}

export async function generateStructuredJsonWithBedrock<T extends JsonLike>(
  req: BedrockFeatureRequest,
  opts?: BedrockServiceOptions,
): Promise<BedrockStructuredResult<T>> {
  const response = await generateTextWithBedrock(req, opts);
  const parsed = safeParseJson<T>(response.text);

  return {
    ...response,
    parsed: parsed.parsed,
    parseError: parsed.parseError,
  };
}
