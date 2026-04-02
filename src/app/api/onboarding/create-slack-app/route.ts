import { createClient } from "@/lib/supabase/server";
import { createSlackApp } from "@/lib/slack";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const configToken = formData.get("configToken") as string;
  const appName = formData.get("appName") as string;
  const appImage = formData.get("appImage") as File | null;

  if (!configToken || !appName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const baseUrl = new URL(request.url).origin;
  const redirectUrl = `${baseUrl}/api/onboarding/slack-callback`;

  try {
    const { credentials, oauthUrl } = await createSlackApp(configToken, appName, redirectUrl);

    // Upload image to Supabase storage if provided
    let appImageUrl = null;
    if (appImage) {
      const { data: upload } = await supabase.storage
        .from("app-images")
        .upload(`${user.id}/${Date.now()}-${appImage.name}`, appImage);
      if (upload) {
        const { data: { publicUrl } } = supabase.storage
          .from("app-images")
          .getPublicUrl(upload.path);
        appImageUrl = publicUrl;
      }
    }

    // Upsert tenant record
    await supabase.from("tenants").upsert({
      user_id: user.id,
      slack_config_token: configToken,
      slack_app_id: credentials.appId,
      slack_app_name: appName,
      slack_app_image_url: appImageUrl,
      slack_client_id: credentials.clientId,
      slack_client_secret: credentials.clientSecret,
      slack_signing_secret: credentials.signingSecret,
      status: "onboarding",
    }, { onConflict: "user_id" });

    return NextResponse.json({ oauthUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
