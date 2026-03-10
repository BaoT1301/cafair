// Path: agents/src/adapters/bedrock.ts
//
// Full Bedrock adapter for AI Hire AI / FairSignal
// - Stub-first for hackathon reliability
// - Real-mode support for:
//   * Bedrock model listing (control plane)
//   * Generic JSON invocation (InvokeModel)
//   * Text generation (uses Nova-style messages payload by default)
// - Top-level imports are dynamic so stub mode still works even if AWS SDK packages
//   are not installed locally yet.
//
// Install for real mode:
//   npm i @aws-sdk/client-bedrock @aws-sdk/client-bedrock-runtime
//
// Recommended env:
//   AWS_REGION=us-east-1
//   BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
//   USE_REAL_BEDROCK=true

export type BedrockMode = "stub" | "real";

export interface BedrockConfig {
  mode?: BedrockMode;
  region?: string;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface BedrockTextRequest {
  system?: string;
  prompt: string;
}

export interface BedrockTextResponse {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  modelId?: string;
  raw?: unknown;
}

export interface BedrockModelSummary {
  modelId?: string;
  providerName?: string;
  inputModalities?: string[];
  outputModalities?: string[];
  responseStreamingSupported?: boolean;
}

export interface BedrockInvokeJsonArgs {
  modelId: string;
  body: Record<string, unknown>;
  contentType?: string;
  accept?: string;
  cfg?: BedrockConfig;
}

function stableHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text || "").trim().length / 4));
}

function cleanText(text: string): string {
  return (text || "").replace(/\s+/g, " ").trim();
}

function truthy(v?: string): boolean {
  return v === "1" || v === "true" || v === "TRUE" || v === "yes" || v === "on";
}

function resolveMode(cfg?: BedrockConfig): BedrockMode {
  if (cfg?.mode) return cfg.mode;
  return truthy(process.env.USE_REAL_BEDROCK) ? "real" : "stub";
}

function resolveRegion(cfg?: BedrockConfig): string {
  return cfg?.region ?? process.env.AWS_REGION ?? "us-east-1";
}

function resolveModelId(cfg?: BedrockConfig): string {
  return cfg?.modelId ?? process.env.BEDROCK_MODEL_ID ?? "stub-nova-lite";
}

function resolveMaxTokens(cfg?: BedrockConfig): number {
  return cfg?.maxTokens ?? 256;
}

function resolveTemperature(cfg?: BedrockConfig): number {
  return cfg?.temperature ?? 0.2;
}

function pickStubReply(req: BedrockTextRequest): string {
  const prompt = req.prompt.toLowerCase();
  const key = stableHash((req.system ?? "") + "||" + req.prompt);

  if (prompt.includes("follow-up") || prompt.includes("email")) {
    const replies = [
      "Thanks for speaking with us today. We’d like to move you to the next step and will share scheduling details shortly.",
      "Thank you for your time at the career fair. We’d love to continue the conversation and coordinate next steps.",
      "We appreciate your interest. Please share a few times that work for a short follow-up conversation this week.",
    ];
    return replies[key % replies.length];
  }

  if (
    prompt.includes("risk") ||
    prompt.includes("verify") ||
    prompt.includes("mismatch")
  ) {
    const replies = [
      "Moderate risk signal detected. Recommend confirming timeline claims and requesting one supporting artifact.",
      "High-confidence mismatch signal. Ask a short clarification question before advancing to the next stage.",
      "Low risk overall, but one claim should be verified with a quick follow-up.",
    ];
    return replies[key % replies.length];
  }

  if (prompt.includes("summary") || prompt.includes("summarize")) {
    const replies = [
      "Strong overall fit with clear project evidence. Recommend moving to recruiter review.",
      "Potential fit with partial must-have coverage. A quick screen is recommended before recruiter time.",
      "Candidate shows relevant signals but needs stronger proof on core requirements.",
    ];
    return replies[key % replies.length];
  }

  if (prompt.includes("score") || prompt.includes("rubric")) {
    const replies = [
      "Fit is strong on must-haves and communication. Main gap is depth evidence on one required skill.",
      "Candidate meets several criteria but should complete a short micro-screen to validate role alignment.",
      "Evidence suggests medium alignment with one notable risk factor requiring clarification.",
    ];
    return replies[key % replies.length];
  }

  const generic = [
    "Here is a concise, evidence-based output for the current step.",
    "This result is generated in stub mode for demo reliability.",
    "Recommended next action: proceed with the highest-signal, lowest-risk path.",
  ];

  return generic[key % generic.length];
}

function extractTextFromParsed(parsed: any): string {
  if (!parsed) return "";

  if (typeof parsed === "string") return cleanText(parsed);

  if (Array.isArray(parsed?.output?.message?.content)) {
    const textBlock = parsed.output.message.content.find((c: any) => c?.text);
    if (textBlock?.text) return cleanText(textBlock.text);
  }

  if (Array.isArray(parsed?.content)) {
    const textBlock = parsed.content.find((c: any) => c?.text);
    if (textBlock?.text) return cleanText(textBlock.text);
  }

  if (Array.isArray(parsed?.messages)) {
    const last = parsed.messages[parsed.messages.length - 1];
    if (Array.isArray(last?.content)) {
      const textBlock = last.content.find((c: any) => c?.text);
      if (textBlock?.text) return cleanText(textBlock.text);
    }
  }

  if (parsed?.outputText) return cleanText(parsed.outputText);
  if (parsed?.text) return cleanText(parsed.text);

  if (Array.isArray(parsed?.results) && parsed.results[0]?.outputText) {
    return cleanText(parsed.results[0].outputText);
  }

  if (Array.isArray(parsed?.outputs) && parsed.outputs[0]?.text) {
    return cleanText(parsed.outputs[0].text);
  }

  if (Array.isArray(parsed?.generation) && parsed.generation[0]?.text) {
    return cleanText(parsed.generation[0].text);
  }

  return cleanText(JSON.stringify(parsed));
}

function parseRuntimeResponse(rawText: string): { text: string; parsed: unknown } {
  let parsed: any = rawText;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      text: cleanText(rawText),
      parsed: rawText,
    };
  }

  return {
    text: extractTextFromParsed(parsed),
    parsed,
  };
}

async function loadBedrockControlPlane(region: string) {
  const aws = await import("@aws-sdk/client-bedrock");
  const client = new aws.BedrockClient({ region });
  return { aws, client };
}

async function loadBedrockRuntime(region: string) {
  const aws = await import("@aws-sdk/client-bedrock-runtime");
  const client = new aws.BedrockRuntimeClient({ region });
  return { aws, client };
}

// ---------------------------
// Model listing
// ---------------------------
export async function listFoundationModels(
  cfg?: BedrockConfig
): Promise<BedrockModelSummary[]> {
  const mode = resolveMode(cfg);
  const region = resolveRegion(cfg);

  if (mode === "stub") {
    return [
      {
        modelId: "amazon.nova-lite-v1:0",
        providerName: "Amazon",
        inputModalities: ["TEXT"],
        outputModalities: ["TEXT"],
        responseStreamingSupported: true,
      },
      {
        modelId: "amazon.nova-micro-v1:0",
        providerName: "Amazon",
        inputModalities: ["TEXT"],
        outputModalities: ["TEXT"],
        responseStreamingSupported: true,
      },
      {
        modelId: "amazon.nova-pro-v1:0",
        providerName: "Amazon",
        inputModalities: ["TEXT"],
        outputModalities: ["TEXT"],
        responseStreamingSupported: true,
      },
    ];
  }

  try {
    const { aws, client } = await loadBedrockControlPlane(region);
    const res = await client.send(new aws.ListFoundationModelsCommand({}));

    return (res.modelSummaries || []).map((m) => ({
      modelId: m.modelId,
      providerName: m.providerName,
      inputModalities: m.inputModalities,
      outputModalities: m.outputModalities,
      responseStreamingSupported: m.responseStreamingSupported,
    }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Bedrock list error";
    throw new Error(
      `listFoundationModels failed. Check AWS credentials, region, IAM permissions, and SDK install. Details: ${message}`
    );
  }
}

// ---------------------------
// Generic JSON invoke
// ---------------------------
export async function invokeJsonModel(
  args: BedrockInvokeJsonArgs
): Promise<{
  raw: string;
  parsed: unknown;
  contentType?: string;
  modelId: string;
}> {
  const cfg = args.cfg;
  const mode = resolveMode(cfg);
  const region = resolveRegion(cfg);

  if (mode === "stub") {
    const fake = {
      ok: true,
      mode: "stub",
      modelId: args.modelId,
      echo: args.body,
    };

    return {
      raw: JSON.stringify(fake),
      parsed: fake,
      contentType: args.contentType ?? "application/json",
      modelId: args.modelId,
    };
  }

  try {
    const { aws, client } = await loadBedrockRuntime(region);

    const res = await client.send(
      new aws.InvokeModelCommand({
        modelId: args.modelId,
        contentType: args.contentType || "application/json",
        accept: args.accept || "application/json",
        body: JSON.stringify(args.body),
      })
    );

    const raw = new TextDecoder().decode(res.body);
    const { parsed } = parseRuntimeResponse(raw);

    return {
      raw,
      parsed,
      contentType: res.contentType,
      modelId: args.modelId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Bedrock invoke error";
    throw new Error(
      `invokeJsonModel failed. Check AWS credentials, region, modelId, IAM permissions, request body shape, and SDK install. Details: ${message}`
    );
  }
}

// ---------------------------
// Main text generation
// ---------------------------
export async function bedrockGenerateText(
  cfg: BedrockConfig,
  req: BedrockTextRequest
): Promise<BedrockTextResponse> {
  const mode = resolveMode(cfg);
  const region = resolveRegion(cfg);
  const modelId = resolveModelId(cfg);
  const maxTokens = resolveMaxTokens(cfg);
  const temperature = resolveTemperature(cfg);

  if (mode === "stub") {
    const text = cleanText(pickStubReply(req));

    return {
      text,
      usage: {
        inputTokens: estimateTokens((req.system ?? "") + "\n" + req.prompt),
        outputTokens: estimateTokens(text),
      },
      modelId,
      raw: {
        mode: "stub",
        region,
        maxTokens,
        temperature,
      },
    };
  }

  try {
    const { aws, client } = await loadBedrockRuntime(region);

    // Default to Nova-style messages payload, which works for modern Amazon Nova text models.
    const body = JSON.stringify({
      schemaVersion: "messages-v1",
      ...(req.system
        ? {
            system: [
              {
                text: req.system,
              },
            ],
          }
        : {}),
      messages: [
        {
          role: "user",
          content: [
            {
              text: req.prompt,
            },
          ],
        },
      ],
      inferenceConfig: {
        max_new_tokens: maxTokens,
        temperature,
      },
    });

    const command = new aws.InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body,
    });

    const response = await client.send(command);

    let text = "";
    let parsed: unknown = response;

    if (response.body) {
      const rawText = new TextDecoder("utf-8").decode(response.body);
      const parsedResult = parseRuntimeResponse(rawText);
      text = parsedResult.text;
      parsed = parsedResult.parsed;
    }

    return {
      text,
      usage: {
        inputTokens: estimateTokens((req.system ?? "") + "\n" + req.prompt),
        outputTokens: estimateTokens(text),
      },
      modelId,
      raw: parsed,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Bedrock error";

    throw new Error(
      `bedrockGenerateText real mode failed. Check AWS credentials, region, modelId, IAM permissions, request schema, and SDK install. Details: ${message}`
    );
  }
}

// ---------------------------
// Convenience helper
// ---------------------------
export async function bedrockSummarize(
  cfg: BedrockConfig,
  input: string
): Promise<string> {
  const res = await bedrockGenerateText(cfg, {
    system: "You are a concise assistant that produces short, factual summaries.",
    prompt: `Summarize this in 2 sentences:\n\n${input}`,
  });

  return res.text;
}