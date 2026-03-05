import fs from "fs";
import archiver from "archiver";
import {
  LambdaClient,
  GetFunctionCommand,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  waitUntilFunctionUpdated,
} from "@aws-sdk/client-lambda";

import { getVaultSecrets } from "./vault.js";

const client = new LambdaClient({
  region: process.env.AWS_REGION,
});

const FUNCTION_NAME = process.env.LAMBDA_NAME;

async function zipLambda() {
  const output = fs.createWriteStream("/tmp/lambda.zip");
  const archive = archiver("zip");

  archive.pipe(output);

  const lambdaSource = process.env.LAMBDA_SOURCE_PATH;
  archive.directory(lambdaSource, false);

  await archive.finalize();

  return new Promise((resolve) => {
    output.on("close", () => resolve("/tmp/lambda.zip"));
  });
}

function stringToList(input) {
  // transform into array
  const list = input
    .split(",") // split by comma
    .map((item) => item.trim()) // remove extra spaces
    .filter(Boolean); // remove empty values (optional)

  return list;
}

async function lambdaExists() {
  try {
    await client.send(
      new GetFunctionCommand({
        FunctionName: FUNCTION_NAME,
      }),
    );
    return true;
  } catch (err) {
    if (err.name === "ResourceNotFoundException") {
      return false;
    }
    throw err;
  }
}

async function waitForLambdaUpdate() {
  console.log("⏳ Waiting for Lambda update to finish...");

  await waitUntilFunctionUpdated(
    {
      client,
      maxWaitTime: 300, // seconds
    },
    {
      FunctionName: FUNCTION_NAME,
    },
  );
  console.log("✅ Lambda ready");
}

async function deploy() {
  console.log("Fetching Vault secrets...");
  const envVars = await getVaultSecrets();

  console.log("Packaging Lambda...");
  const zipPath = await zipLambda();
  const zipBuffer = fs.readFileSync(zipPath);

  const exists = await lambdaExists();

  if (!exists) {
    console.log("🚀 Creating new Lambda...");

    await client.send(
      new CreateFunctionCommand({
        FunctionName: FUNCTION_NAME,
        Role: process.env.LAMBDA_ROLE_ARN,
        Runtime: process.env.LAMBDA_RUNTIME,
        Handler: process.env.LAMBDA_HANDLER,
        Code: {
          ZipFile: zipBuffer,
        },
        Environment: {
          Variables: envVars,
        },
        MemorySize: Number(process.env.LAMBDA_MEMORY),
        Timeout: Number(process.env.LAMBDA_TIMEOUT),
        Publish: true,
        VpcConfig: {
          SubnetIds: stringToList(process.env.LAMBDA_SUBNET_IDS),
          SecurityGroupIds: stringToList(process.env.LAMBDA_SECURITY_GROUP_IDS),
          Ipv6AllowedForDualStack: false,
        },
      }),
    );

    console.log("✅ Lambda created");
    return;
  }

  console.log("♻️ Updating existing Lambda code...");
  await client.send(
    new UpdateFunctionCodeCommand({
      FunctionName: FUNCTION_NAME,
      ZipFile: zipBuffer,
      Publish: true,
    }),
  );
  await waitForLambdaUpdate();

  const layerArnCollector =
    "arn:aws:lambda:us-east-1:901920570463:layer:aws-otel-nodejs-amd64-ver-1-30-2:1";
  const layerArnNodeJs =
    "arn:aws:lambda:us-east-1:184161586896:layer:opentelemetry-nodejs-0_20_0:1";
  let layers = [];

  if (process.env.ENABLE_OTEL_LAMBDA_LAYER) {
    layers.push(layerArnNodeJs);
    layers.push(layerArnCollector);
  }

  console.log("Updating configuration...");
  await client.send(
    new UpdateFunctionConfigurationCommand({
      FunctionName: FUNCTION_NAME,
      Environment: {
        Variables: envVars,
      },
      Layers: layers,
      MemorySize: Number(process.env.LAMBDA_MEMORY),
      Timeout: Number(process.env.LAMBDA_TIMEOUT),
      VpcConfig: {
        SubnetIds: stringToList(process.env.LAMBDA_SUBNET_IDS),
        SecurityGroupIds: stringToList(process.env.LAMBDA_SECURITY_GROUP_IDS),
        Ipv6AllowedForDualStack: false,
      },
    }),
  );

  console.log("✅ Lambda updated");
}

deploy().catch((err) => {
  console.error(err);
  process.exit(1);
});
