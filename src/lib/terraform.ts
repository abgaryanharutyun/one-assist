import { execSync } from "child_process";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import path from "path";

const TF_DIR = path.resolve(process.cwd(), "terraform");

function loadTerraformEnv(): Record<string, string> {
  const envPath = path.join(TF_DIR, ".env");
  const content = readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    env[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1);
  }
  return env;
}

interface ProvisionInput {
  tenantId: string;
  slackBotToken: string;
  slackSigningSecret: string;
  slackAuthedUserId: string;
  aiProvider: string;
  aiApiKey: string;
}

interface ProvisionOutput {
  vmIp: string;
  vmName: string;
  openclawUrl: string;
  gatewayToken: string;
}

export function provisionVM(input: ProvisionInput): ProvisionOutput {
  const tfEnv = loadTerraformEnv();
  const gatewayToken = randomBytes(32).toString("hex");
  const workspace = `tenant-${input.tenantId}`;

  const execOpts = {
    cwd: TF_DIR,
    stdio: "pipe" as const,
    timeout: 300000,
    env: {
      ...process.env,
      GOOGLE_APPLICATION_CREDENTIALS: tfEnv.GCP_CREDENTIALS_PATH,
    },
  };

  // Select or create workspace
  try {
    execSync(`terraform workspace select ${workspace}`, execOpts);
  } catch {
    execSync(`terraform workspace new ${workspace}`, execOpts);
  }

  // Run terraform apply
  const tfVars = [
    `-var="project_id=${tfEnv.GCP_PROJECT_ID}"`,
    `-var="tenant_id=${input.tenantId}"`,
    `-var="slack_bot_token=${input.slackBotToken}"`,
    `-var="slack_signing_secret=${input.slackSigningSecret}"`,
    `-var="slack_authed_user_id=${input.slackAuthedUserId}"`,
    `-var="ai_provider=${input.aiProvider}"`,
    `-var="ai_api_key=${input.aiApiKey}"`,
    `-var="gateway_token=${gatewayToken}"`,
    `-var="domain=${tfEnv.PLATFORM_DOMAIN}"`,
    `-var="dns_zone_name=${tfEnv.GCP_DNS_ZONE_NAME}"`,
    `-var="letsencrypt_email=${tfEnv.LETSENCRYPT_EMAIL}"`,
  ].join(" ");

  execSync(`terraform apply -auto-approve ${tfVars}`, execOpts);

  // Get outputs
  const output = execSync("terraform output -json", { ...execOpts, encoding: "utf-8" });
  const parsed = JSON.parse(output);

  return {
    vmIp: parsed.vm_ip.value,
    vmName: parsed.vm_name.value,
    openclawUrl: parsed.openclaw_url.value,
    gatewayToken,
  };
}

export function destroyVM(tenantId: string): void {
  const tfEnv = loadTerraformEnv();
  const workspace = `tenant-${tenantId}`;

  const execOpts = {
    cwd: TF_DIR,
    stdio: "pipe" as const,
    timeout: 300000,
    env: {
      ...process.env,
      GOOGLE_APPLICATION_CREDENTIALS: tfEnv.GCP_CREDENTIALS_PATH,
    },
  };

  execSync(`terraform workspace select ${workspace}`, execOpts);
  execSync(`terraform destroy -auto-approve`, execOpts);
}
