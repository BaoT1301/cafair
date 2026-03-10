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
