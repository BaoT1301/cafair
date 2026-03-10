# AWS Setup Guide for us
**Goal:** get everything ready for the AI Hire AI **before coding**  
**Outcome:** teammate can use AWS for:
- S3 storage
- Lambda
- Bedrock
- Amazon Nova Act
- local testing in VS Code terminal
- console testing
- real workflow smoke tests

---

## 0) What we are setting up

We want your AWS account to be ready for these project needs:

- **S3 bucket** to store artifacts or test files
- **Lambda function** for quick backend smoke tests and future API logic
- **Amazon Nova Act workflow definition** for real action runs
- **Bedrock access** for model listing / future model calls
- **Local IAM credentials** so your VS Code terminal can call AWS SDK directly
- **Optional Function URL** for easy testing later

By the end, you should be able to confirm:

- S3 test file upload works
- Bedrock model listing works
- Nova Act `ListModels` works
- Nova Act `CreateWorkflowRun` works
- Nova Act `GetWorkflowRun` works

---

## 1) Create or sign in to AWS account

### If this is your first AWS account
1. Create/sign in to AWS
2. Choose region:
   - use **US East (N. Virginia)**  
   - region code: **`us-east-1`**

We keep everything in the same region to avoid confusion.

---

## 2) Create an S3 bucket

### In AWS Console
- Go to **S3**
- Click **Create bucket**
- Choose a globally unique bucket name

### Recommended naming
Use something like:
- `aihire-yourname`
- `aihire-demo-yourname`

### Region
- **US East (N. Virginia)**
- `us-east-1`

### Save these values
Example format:

- **Bucket name:** `aihire-yourname`
- **Bucket ARN:** `arn:aws:s3:::aihire-yourname`

---

## 3) Create a Lambda function

### In AWS Console
- Go to **Lambda**
- Click **Create function**
- Choose **Author from scratch**

### Use these settings
- **Function name:** `aihireai-api`
- **Runtime:** `Node.js 22.x`
- **Architecture:** `arm64`
- Create a **new execution role**

### Save these values
- **Function name**
- **Function ARN**

Example format:
- `arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:aihireai-api`

---

## 4) (Optional but useful) Create a Lambda Function URL

This is useful later if you want an HTTP endpoint quickly.

### In Lambda
- Open your function
- Go to **Function URL**
- Create Function URL

### Auth type
Pick one:
- **AWS_IAM** (safer)
- **NONE** (faster for hackathon demo, only if you understand the risk)

### Save
- Function URL

---

## 5) Create an Amazon Nova Act workflow definition

### In AWS Console
- Go to **Amazon Nova Act**
- Create a new workflow definition

### Recommended name
- `aihireai-act`

### Save these values
- **Workflow name:** `aihireai-act`
- **Workflow ARN**

Example format:
- `arn:aws:nova-act:us-east-1:YOUR_ACCOUNT_ID:workflow-definition/aihireai-act`

---

## 6) Add Lambda environment variables

Go to:

- **Lambda**
- open `aihireai-api`
- **Configuration**
- **Environment variables**

### Add these custom variables

```env
S3_BUCKET=aihire-yourname
MODEL_REGION=us-east-1
NOVA_ACT_WORKFLOW_NAME=aihireai-act
NOVA_ACT_WORKFLOW_ARN=arn:aws:nova-act:us-east-1:YOUR_ACCOUNT_ID:workflow-definition/aihireai-act

Important

Do not manually add:
	•	AWS_REGION
	•	AWS_DEFAULT_REGION

Lambda provides reserved AWS region variables automatically.

If your code needs the region, read:
```bash
const region = process.env.AWS_REGION || "us-east-1";
```

## 7) Add IAM permissions to the Lambda execution role

Go to:
	•	Lambda
	•	open aihireai-api
	•	Configuration
	•	Permissions
	•	click the execution role

You need to add inline policies.

## 7A) Add S3 policy to Lambda role

Replace aihire-yourname with the real bucket.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::aihire-yourname"]
    },
    {
      "Sid": "RWObjects",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::aihire-yourname/*"]
    }
  ]
}
```

## 7B) Add Bedrock policy to Lambda role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeModels",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "*"
    },
    {
      "Sid": "BedrockUtilitiesOptional",
      "Effect": "Allow",
      "Action": [
        "bedrock:CountTokens",
        "bedrock:ListFoundationModels"
      ],
      "Resource": "*"
    },
    {
      "Sid": "BedrockGuardrailsOptional",
      "Effect": "Allow",
      "Action": [
        "bedrock:ApplyGuardrail"
      ],
      "Resource": "*"
    }
  ]
}
```

## 7C) Add Nova Act policy to Lambda role

Replace the workflow ARN.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "NovaActListModels",
      "Effect": "Allow",
      "Action": [
        "nova-act:ListModels"
      ],
      "Resource": "*"
    },
    {
      "Sid": "NovaActWorkflowRunAccess",
      "Effect": "Allow",
      "Action": [
        "nova-act:CreateWorkflowRun",
        "nova-act:GetWorkflowRun",
        "nova-act:ListWorkflowRuns"
      ],
      "Resource": [
        "arn:aws:nova-act:us-east-1:YOUR_ACCOUNT_ID:workflow-definition/aihireai-act",
        "*"
      ]
    }
  ]
}
```

## 8) Test S3 in Lambda console

This is the fastest first sanity check.

In Lambda code editor

Paste this test code:

```bash
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler = async () => {
  const bucket = process.env.S3_BUCKET;
  const key = "debug/test.txt";

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: `S3 test OK at ${new Date().toISOString()}`,
      ContentType: "text/plain",
    })
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      bucket,
      key,
      message: "Wrote test file to S3",
    }),
  };
};
```

Then
	•	Click Deploy
	•	Click Test
	•	Use any event like {}

Expected success

Response should show:

{
  "ok": true
}

Then check S3 bucket:
	•	file should exist at:
	•	debug/test.txt

If this works:
	•	Lambda exists
	•	env vars work
	•	S3 permissions work


## 9) Test Bedrock in Lambda console

Replace Lambda code with this:

```bash
import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock";

const bedrock = new BedrockClient({ region: process.env.AWS_REGION });

export const handler = async () => {
  const res = await bedrock.send(new ListFoundationModelsCommand({}));

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      count: res.modelSummaries?.length || 0,
      firstFew: (res.modelSummaries || []).slice(0, 5).map((m) => ({
        modelId: m.modelId,
        providerName: m.providerName,
      })),
    }),
  };
};
```

Then
	•	Deploy
	•	Test

Expected success

Response should show:
	•	ok: true
	•	a nonzero count

If this works:
	•	Bedrock permissions are good


## 10) Test Nova Act locally (best path)

For Nova Act, local testing is easier than the Lambda inline editor because you need the extra AWS SDK package.


## 11) Create local test folder in VS Code terminal

Open VS Code terminal and run:
```bash
mkdir -p novaact-local-test
cd novaact-local-test
npm init -y
npm install @aws-sdk/client-nova-act
```


12) Set up local AWS credentials (recommended: IAM user)

If you are a FIRSTirst-time AWS user and SSO is not set up, use IAM access keys for local CLI.

Create IAM access key

In AWS Console:
	•	IAM
	•	Users
	•	click the user
	•	Security credentials
	•	Create access key
	•	choose CLI usage

Save:
	•	Access Key ID
	•	Secret Access Key

Configure local profile

Run:
```bash
aws configure --profile local-iam
```

Enter:
	•	AWS Access Key ID
	•	AWS Secret Access Key
	•	region: us-east-1
	•	output: json

Verify local identity

```bash
aws sts get-caller-identity --profile local-iam
```

Expected: 
```json
{
    "UserId": "AIDAJNWO...",
    "Account": "54252100103",
    "Arn": "arn:aws:iam::54252100103:user/noro-dev"
}
```

## 13) Add Nova Act permissions to the IAM user (for local terminal testing)

Important: local terminal uses the IAM user, not the Lambda role.

So add the same Nova Act permissions to the user too.

Go to:
	•	IAM
	•	Users
	•	click the user
	•	Add permissions
	•	create inline policy

Use:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "NovaActListModels",
      "Effect": "Allow",
      "Action": [
        "nova-act:ListModels"
      ],
      "Resource": "*"
    },
    {
      "Sid": "NovaActWorkflowRunAccess",
      "Effect": "Allow",
      "Action": [
        "nova-act:CreateWorkflowRun",
        "nova-act:GetWorkflowRun",
        "nova-act:ListWorkflowRuns"
      ],
      "Resource": [
        "arn:aws:nova-act:us-east-1:YOUR_ACCOUNT_ID:workflow-definition/aihireai-act",
        "*"
      ]
    }
  ]
}
```

If you want local Bedrock or S3 calls, add those policies to the user too.

## 14) Create list-models.mjs

In novaact-local-test/, create:

```bash
import { NovaActClient, ListModelsCommand } from "@aws-sdk/client-nova-act";

const client = new NovaActClient({
  region: "us-east-1",
});

async function main() {
  const res = await client.send(
    new ListModelsCommand({
      clientCompatibilityVersion: 1,
    })
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        models: (res.models || []).map((m) => ({
          modelId: m.modelId,
          status: m.modelLifecycle?.status,
          minimumCompatibilityVersion: m.minimumCompatibilityVersion,
        })),
        compatibility: res.compatibilityInformation,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("Nova Act ListModels failed:");
  console.error(err);
  process.exit(1);
});
```

RUN:
```bash
AWS_PROFILE=local-iam node list-models.mjs
```

Expected success

Output should show:
	•	ok: true
	•	compatibility.supportedModelIds

If models is empty but supportedModelIds exists, that is still okay.

Important model alias

For workflow runs, use:
	•	nova-act-preview

Even if supported model IDs show raw preview versions, use the alias.


## 15) Create run-workflow.mjs

In novaact-local-test/, create:

```bash
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
```

Run:

```bash
AWS_PROFILE=local-iam node run-workflow.mjs
```

You should see:
	•	CreateWorkflowRun response
	•	a workflowRunId
	•	status likely starts as RUNNING

Even if final status is still RUNNING, that is enough to confirm:
	•	real Nova Act integration works
	•	workflow run started successfully

## 16) Project .env values

When everything works, add this to project env (for local development):

AWS_REGION=us-east-1
AWS_PROFILE=local-iam

NOVA_ACT_WORKFLOW_NAME=(double check these on aws console)
NOVA_ACT_WORKFLOW_ARN=arn:aws:nova-act:us-east-1:YOUR_ACCOUNT_ID:workflow-definition/.....
NOVA_ACT_MODEL_ID=nova-act-preview

S3_BUCKET=... (double check these on aws console)

USE_REAL_NOVA_ACT=true

Important

If using AWS_PROFILE=local-iam, do not put raw access keys in .env unless absolutely needed.

## 17) What is considered “ready before coding”

Teammate is ready to start coding when all of these are true:
	•	S3 bucket created
	•	Lambda created
	•	Nova Act workflow definition created
	•	Lambda role has S3 policy
	•	Lambda role has Bedrock policy
	•	Lambda role has Nova Act policy
	•	S3 test in Lambda succeeded
	•	Bedrock test in Lambda succeeded
	•	local IAM access key configured
	•	local IAM user has Nova Act policy
	•	node list-models.mjs works
	•	node run-workflow.mjs starts a real workflow run
	•	.env is filled out

If all of the above pass, teammate is fully ready to integrate AWS into the app.


## 18) Common mistakes to avoid
	•	adding Nova Act policy only to Lambda role, but not to local IAM user
	•	trying to use raw preview model version directly instead of nova-act-preview
	•	manually adding reserved Lambda env vars like AWS_DEFAULT_REGION
	•	testing local Node scripts without AWS_PROFILE=local-iam
	•	mixing resources across different regions
	•	reusing someone else’s bucket name, workflow ARN, or account ID


## 19) Final recommended constants to standardize across the team

Use the same naming pattern for everyone:
	•	Region: us-east-1
	•	Lambda: aihireai-api
	•	Workflow name: aihireai-act
	•	Nova Act model alias: nova-act-preview

Only these should be UNIQUEEE per teammate:
	•	S3 bucket name
	•	account ID
	•	Lambda ARN
	•	workflow ARN
	•	IAM user access keys