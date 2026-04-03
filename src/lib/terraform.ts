import { execSync } from "child_process";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
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
  agentId: string;
  organizationId: string;
  slackBotToken: string;
  slackSigningSecret: string;
  slackAuthedUserId: string;
  aiProvider: string;
  aiApiKey: string;
  initialSkills?: Array<{
    name: string;
    slug: string;
    description: string;
    instructions: string;
    script?: string | null;
    script_language?: string | null;
  }>;
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
  const workspace = `agent-${input.agentId}`;

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

  // Write tfvars JSON file to avoid shell escaping issues
  const tfVarsFile = path.join(TF_DIR, ".auto.tfvars.json");
  const tfVarsData = {
    project_id: tfEnv.GCP_PROJECT_ID,
    tenant_id: input.agentId,
    slack_bot_token: input.slackBotToken,
    slack_signing_secret: input.slackSigningSecret,
    slack_authed_user_id: input.slackAuthedUserId,
    ai_provider: input.aiProvider,
    ai_api_key: input.aiApiKey,
    gateway_token: gatewayToken,
    domain: tfEnv.PLATFORM_DOMAIN,
    dns_zone_name: tfEnv.GCP_DNS_ZONE_NAME,
    letsencrypt_email: tfEnv.LETSENCRYPT_EMAIL,
    platform_url: tfEnv.PLATFORM_URL || "",
    agent_id: input.agentId,
    org_id: input.organizationId,
    initial_skills_json: JSON.stringify(input.initialSkills || []),
  };
  writeFileSync(tfVarsFile, JSON.stringify(tfVarsData, null, 2));

  try {
    execSync(`terraform apply -auto-approve -var-file=.auto.tfvars.json`, execOpts);
  } finally {
    try { unlinkSync(tfVarsFile); } catch {}
  }

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

export function destroyVM(agentId: string): void {
  const tfEnv = loadTerraformEnv();
  const workspace = `agent-${agentId}`;

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
