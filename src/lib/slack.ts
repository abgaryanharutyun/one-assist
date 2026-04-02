const SLACK_API = "https://slack.com/api";

export interface SlackAppCredentials {
  appId: string;
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  verificationToken: string;
}

export async function createSlackApp(
  configToken: string,
  appName: string,
  redirectUrl: string
): Promise<{ credentials: SlackAppCredentials; oauthUrl: string }> {
  const manifest = {
    _metadata: { major_version: 1, minor_version: 1 },
    display_information: {
      name: appName,
      description: `${appName} - AI Assistant powered by OpenClaw`,
    },
    features: {
      bot_user: {
        display_name: appName,
        always_online: true,
      },
      app_home: {
        home_tab_enabled: true,
        messages_tab_enabled: true,
        messages_tab_read_only_enabled: false,
      },
    },
    oauth_config: {
      redirect_urls: [redirectUrl],
      scopes: {
        bot: [
          "app_mentions:read",
          "channels:read",
          "chat:write",
          "chat:write.public",
          "groups:read",
          "im:read",
          "im:write",
          "im:history",
          "users:read",
          "reactions:read",
          "reactions:write",
          "files:read",
          "files:write",
        ],
      },
    },
    settings: {
      event_subscriptions: {
        bot_events: [
          "app_home_opened",
          "app_mention",
          "message.channels",
          "message.groups",
          "message.im",
          "message.mpim",
          "reaction_added",
          "member_joined_channel",
        ],
      },
      interactivity: { is_enabled: true },
      org_deploy_enabled: false,
      socket_mode_enabled: true,
      token_rotation_enabled: true,
    },
  };

  const res = await fetch(`${SLACK_API}/apps.manifest.create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ manifest: JSON.stringify(manifest) }),
  });

  const data = await res.json();

  if (!data.ok) {
    throw new Error(data.error || "Failed to create Slack app");
  }

  const credentials: SlackAppCredentials = {
    appId: data.app_id,
    clientId: data.credentials.client_id,
    clientSecret: data.credentials.client_secret,
    signingSecret: data.credentials.signing_secret,
    verificationToken: data.credentials.verification_token,
  };

  const scopes = manifest.oauth_config.scopes.bot.join(",");
  const oauthUrl =
    `https://slack.com/oauth/v2/authorize?client_id=${credentials.clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUrl)}`;

  return { credentials, oauthUrl };
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  teamName: string;
  teamId: string;
  botUserId: string;
}> {
  const res = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json();

  if (!data.ok) {
    throw new Error(data.error || "OAuth token exchange failed");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || "",
    teamName: data.team?.name || "",
    teamId: data.team?.id || "",
    botUserId: data.bot_user_id || "",
  };
}
