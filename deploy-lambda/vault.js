import axios from "axios";

export async function getVaultSecrets() {
  const skipVault = process.env.SKIP_VAULT;
  const vaultAddr = process.env.VAULT_ADDR;
  const roleId = process.env.VAULT_APPROLE_ID;
  const secretId = process.env.VAULT_SECRET_ID;
  const secretPath = process.env.VAULT_SECRET_PATH;

  if (skipVault == "true") {
    console.log("Skipping vault step. Returning {}");
    return {};
  }

  // Login using AppRole
  const loginRes = await axios.post(
    `${vaultAddr}/v1/auth/approle-educon/login`,
    {
      role_id: roleId,
      secret_id: secretId,
    },
  );

  const token = loginRes.data.auth.client_token;

  // Fetch secrets
  const secretRes = await axios.get(`${vaultAddr}/v1/${secretPath}`, {
    headers: {
      "X-Vault-Token": token,
    },
  });

  // KV v2 format
  const secrets = secretRes.data.data.data;

  // Convert everything to string (Lambda requires strings)
  const envVars = {};
  for (const [key, value] of Object.entries(secrets)) {
    envVars[key] = String(value);
  }

  return envVars;
}
