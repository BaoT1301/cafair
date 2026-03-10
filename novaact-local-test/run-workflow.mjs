import {
  NovaActClient,
  CreateWorkflowRunCommand,
  GetWorkflowRunCommand,
} from "@aws-sdk/client-nova-act";

const client = new NovaActClient({
  region: "us-east-1",
});

const workflowDefinitionName = "aihireai-act";
const modelId = "nova-act-preview";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeClientToken() {
  return `smoketest-${Date.now()}-${Math.random().toString(36).slice(2, 20)}`;
}

async function main() {
  const createRes = await client.send(
    new CreateWorkflowRunCommand({
      workflowDefinitionName,
      modelId,
      clientToken: makeClientToken(),
      clientInfo: {
        compatibilityVersion: 1,
        sdkVersion: "local-smoke-test",
      },
    })
  );

  console.log("CreateWorkflowRun response:");
  console.log(JSON.stringify(createRes, null, 2));

  const workflowRunId = createRes.workflowRunId;
  if (!workflowRunId) {
    throw new Error("No workflowRunId returned");
  }

  let latest = null;

  for (let i = 0; i < 20; i++) {
    latest = await client.send(
      new GetWorkflowRunCommand({
        workflowDefinitionName,
        workflowRunId,
      })
    );

    console.log(`Poll ${i + 1}: ${latest.status}`);

    if (
      latest.status === "SUCCEEDED" ||
      latest.status === "FAILED" ||
      latest.status === "TIMED_OUT"
    ) {
      break;
    }

    await sleep(1500);
  }

  console.log("Final workflow run:");
  console.log(JSON.stringify(latest, null, 2));
}

main().catch((err) => {
  console.error("Nova Act workflow test failed:");
  console.error(err);
  process.exit(1);
});
