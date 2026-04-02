import { execSync } from "child_process";
import { randomBytes } from "crypto";
import path from "path";

const TF_DIR = path.resolve(process.cwd(), "terraform");

interface ProvisionInput {
  tenantId: string;
  slackBotToken: string;
  slackAppToken: string;
}

interface ProvisionOutput {
  vmIp: string;
  vmName: string;
  openclawUrl: string;
}

export function provisionVM(input: ProvisionInput): ProvisionOutput {
  const gatewayToken = randomBytes(32).toString("hex");
  const workspace = `tenant-${input.tenantId}`;

  // Select or create workspace
  try {
    execSync(`terraform workspace select ${workspace}`, { cwd: TF_DIR, stdio: "pipe" });
  } catch {
    execSync(`terraform workspace new ${workspace}`, { cwd: TF_DIR, stdio: "pipe" });
  }

  // Run terraform apply
  const tfVars = [
    `-var="project_id=${process.env.GCP_PROJECT_ID}"`,
    `-var="tenant_id=${input.tenantId}"`,
    `-var="slack_bot_token=${input.slackBotToken}"`,
    `-var="slack_app_token=${input.slackAppToken}"`,
    `-var="anthropic_api_key=${process.env.ANTHROPIC_API_KEY}"`,
    `-var="gateway_token=${gatewayToken}"`,
    `-var="domain=${process.env.PLATFORM_DOMAIN}"`,
  ].join(" ");

  execSync(`terraform apply -auto-approve ${tfVars}`, {
    cwd: TF_DIR,
    stdio: "pipe",
    timeout: 300000, // 5 min timeout
    env: {
      ...process.env,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GCP_CREDENTIALS_PATH,
    },
  });

  // Get outputs
  const output = execSync("terraform output -json", { cwd: TF_DIR, encoding: "utf-8" });
  const parsed = JSON.parse(output);

  return {
    vmIp: parsed.vm_ip.value,
    vmName: parsed.vm_name.value,
    openclawUrl: parsed.openclaw_url.value,
  };
}

export function destroyVM(tenantId: string): void {
  const workspace = `tenant-${tenantId}`;

  execSync(`terraform workspace select ${workspace}`, { cwd: TF_DIR, stdio: "pipe" });
  execSync(`terraform destroy -auto-approve`, {
    cwd: TF_DIR,
    stdio: "pipe",
    timeout: 300000,
    env: {
      ...process.env,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GCP_CREDENTIALS_PATH,
    },
  });
}
