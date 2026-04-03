import { WebClient } from "@slack/web-api";

export interface SlackAppCredentials {
  appId: string;
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  verificationToken: string;
}

function buildManifest(appName: string, redirectUrl: string) {
  return {
    display_information: {
      name: appName,
      description: "Slack connector for OpenClaw",
    },
    features: {
      bot_user: {
        display_name: appName,
        always_online: false,
      },
      app_home: {
        messages_tab_enabled: true,
        messages_tab_read_only_enabled: false,
      },
    },
    oauth_config: {
      redirect_urls: [redirectUrl],
      scopes: {
        bot: [
          "chat:write",
          "channels:history",
          "channels:read",
          "groups:history",
          "im:history",
          "im:read",
          "im:write",
          "mpim:history",
          "mpim:read",
          "mpim:write",
          "users:read",
          "app_mentions:read",
          "assistant:write",
          "reactions:read",
          "reactions:write",
          "pins:read",
          "pins:write",
          "emoji:read",
          "commands",
          "files:read",
          "files:write",
        ],
      },
    },
    settings: {
      socket_mode_enabled: false,
    },
  };
}

function buildManifestWithUrls(appName: string, redirectUrl: string, eventsUrl: string) {
  const manifest = buildManifest(appName, redirectUrl);
  return {
    ...manifest,
    features: {
      ...manifest.features,
      slash_commands: [
        {
          command: "/openclaw",
          description: "Send a message to OpenClaw",
          url: eventsUrl,
          should_escape: false,
        },
      ],
    },
    settings: {
      ...manifest.settings,
      event_subscriptions: {
        request_url: eventsUrl,
        bot_events: [
          "app_mention",
          "message.channels",
          "message.groups",
          "message.im",
          "message.mpim",
          "reaction_added",
          "reaction_removed",
          "member_joined_channel",
          "member_left_channel",
          "channel_rename",
          "pin_added",
          "pin_removed",
        ],
      },
      interactivity: {
        is_enabled: true,
        request_url: eventsUrl,
      },
    },
  };
}

export async function createSlackApp(
  configToken: string,
  appName: string,
  redirectUrl: string,
): Promise<{ credentials: SlackAppCredentials; oauthUrl: string }> {
  const client = new WebClient(configToken);
  const manifest = buildManifest(appName, redirectUrl);

  const result = await client.apiCall("apps.manifest.create", {
    manifest: JSON.stringify(manifest),
  });

  if (!result.ok) {
    const errors = (result as unknown as Record<string, unknown>).errors;
    const detail = errors ? JSON.stringify(errors) : (result.error as string);
    throw new Error(detail || "Failed to create Slack app");
  }

  const r = result as unknown as Record<string, unknown>;
  const creds = r.credentials as Record<string, string>;
  const credentials: SlackAppCredentials = {
    appId: r.app_id as string,
    clientId: creds.client_id,
    clientSecret: creds.client_secret,
    signingSecret: creds.signing_secret,
    verificationToken: creds.verification_token,
  };

  const scopes = manifest.oauth_config.scopes.bot.join(",");
  const oauthUrl = `https://slack.com/oauth/v2/authorize?client_id=${credentials.clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUrl)}`;

  return { credentials, oauthUrl };
}

export async function updateSlackAppWithEventsUrl(
  configToken: string,
  appId: string,
  appName: string,
  redirectUrl: string,
  eventsUrl: string,
): Promise<void> {
  const client = new WebClient(configToken);
  const manifest = buildManifestWithUrls(appName, redirectUrl, eventsUrl);

  const result = await client.apiCall("apps.manifest.update", {
    app_id: appId,
    manifest: JSON.stringify(manifest),
  });

  if (!result.ok) {
    const errors = (result as unknown as Record<string, unknown>).errors;
    const detail = errors ? JSON.stringify(errors) : (result.error as string);
    throw new Error(`Failed to update Slack app manifest: ${detail}`);
  }
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  teamName: string;
  teamId: string;
  botUserId: string;
  authedUserId: string;
}> {
  const client = new WebClient();

  const result = await client.oauth.v2.access({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  if (!result.ok) {
    throw new Error((result.error as string) || "OAuth token exchange failed");
  }

  const authedUser = (result as unknown as Record<string, any>).authed_user;
  return {
    accessToken: result.access_token || "",
    refreshToken: result.refresh_token || "",
    teamName: result.team?.name || "",
    teamId: result.team?.id || "",
    botUserId: result.bot_user_id || "",
    authedUserId: authedUser?.id || "",
  };
}
