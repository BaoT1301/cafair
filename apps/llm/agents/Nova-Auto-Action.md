## Stephen Current Status

### Command
```bash
python apps/llm/agents/scripts/run-social-capture-nova.py \
  "Nguyen Phan Nguyen" \
  --linkedin "https://www.linkedin.com/in/nguyenpn1/" \
  --github "https://github.com/ngstephen1" \
  --web-query "Nguyen Phan Nguyen hackathon" \
  --web-query "Nguyen Phan Nguyen developer" \
  --pretty
```

### workflow mode is starting correctly

### Output:
```json
(.venv) macbook@Stephens-McDonalds-air cafair % python apps/llm/agents/scripts/run-social-capture-nova.py \
  "Nguyen Phan Nguyen" \
  --linkedin "https://www.linkedin.com/in/nguyenpn1/" \
  --github "https://github.com/ngstephen1" \
  --web-query "Nguyen Phan Nguyen hackathon" \
  --web-query "Nguyen Phan Nguyen developer" \
  --pretty
{
  "ok": true,
  "mode": "workflow",
  "candidateName": "Nguyen Phan Nguyen",
  "workflowRunId": "019ca9f6-7f1e-7ece-9f15-4ae990af8a43",
  "workflowDefinitionName": "aihireai-act",
  "modelId": "nova-act-preview",
  "linkedin": {
    "url": "https://www.linkedin.com/in/nguyenpn1/",
    "found": true,
    "headline": null,
    "currentCompany": null,
    "school": null,
    "skills": null,
    "experiences": null,
    "notes": "Workflow started. Parse workflow output here once your workflow returns structured browser capture data."
  },
  "github": {
    "url": "https://github.com/ngstephen1",
    "found": true,
    "username": "ngstephen1",
    "displayName": null,
    "bio": null,
    "followers": null,
    "following": null,
    "contributionsLastYear": null,
    "pinnedRepos": null,
    "topLanguages": null,
    "notes": "Workflow started. Parse workflow output here once your workflow returns structured browser capture data."
  },
  "web": {
    "queries": [
      "Nguyen Phan Nguyen hackathon",
      "Nguyen Phan Nguyen developer"
    ],
    "results": [],
    "notes": "Workflow started. Map workflow search/browser outputs here after you confirm response fields."
  },
  "warnings": [
    "Workflow mode started successfully.",
    "This script currently normalizes workflow metadata, but not full browser extraction fields yet.",
    "Next step: map your actual workflow output JSON into linkedin/github/web fields."
  ],
  "raw": {
    "start": {
      "ResponseMetadata": {
        "RequestId": "f866fa9e-97fb-4fa2-b46d-eef5a1f8a951",
        "HTTPStatusCode": 201,
        "HTTPHeaders": {
          "date": "Sun, 01 Mar 2026 15:13:49 GMT",
          "content-type": "application/json",
          "content-length": "75",
          "connection": "keep-alive",
          "x-amzn-requestid": "f866fa9e-97fb-4fa2-b46d-eef5a1f8a951"
        },
        "RetryAttempts": 0
      },
      "workflowRunId": "019ca9f6-7f1e-7ece-9f15-4ae990af8a43",
      "status": "RUNNING"
    },
    "final": null
  }
}
```