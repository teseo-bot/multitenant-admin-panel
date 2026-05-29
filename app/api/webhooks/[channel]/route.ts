import { NextRequest, NextResponse } from 'next/server';
import { resolveTenant } from '@/lib/tenant-resolver';

interface RouteParams {
  params: Promise<{
    channel: string;
  }>;
}

export async function POST(req: NextRequest, props: RouteParams) {
  try {
    const params = await props.params;
    const channel = params.channel;
    
    // Parse JSON body, fallback to empty object if unparseable
    const body = await req.json().catch(() => ({}));

    // Extract channel identifier based on the channel type
    let channelIdentifier: string | null = null;

    switch (channel) {
      case 'whatsapp':
        // TODO: Extract actual identifier from Meta's payload structure
        // e.g., body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id
        channelIdentifier = req.headers.get('x-channel-identifier') || body.channel_identifier || null;
        break;
      case 'telegram':
        // TODO: Extract actual identifier from Telegram's payload or webhook URL config
        channelIdentifier = req.headers.get('x-channel-identifier') || body.channel_identifier || null;
        break;
      default:
        channelIdentifier = req.headers.get('x-channel-identifier') || body.channel_identifier || null;
        break;
    }

    if (!channelIdentifier) {
      console.warn(`[Webhook][${channel}] Missing channel identifier.`);
      // Fail-safe: Returning 200 avoids infinite retries from webhook providers
      return NextResponse.json({ success: true, note: "Ignored (Missing Identifier)" }, { status: 200 });
    }

    // Resolve the tenant using the caching logic
    const tenantId = await resolveTenant(channel, channelIdentifier);

    if (!tenantId) {
      console.log(`[Webhook][${channel}] Ignored payload for unregistered identifier: ${channelIdentifier}`);
      return NextResponse.json({ success: true, note: "Ignored (Unregistered)" }, { status: 200 });
    }

    // Inject tenant_id into the payload intended for LangGraph/Event Bridge
    const enrichedPayload = {
      ...body,
      tenant_id: tenantId
    };

    // TODO: Forward `enrichedPayload` to the LangGraph Orchestrator or Queue (e.g., Pg-Boss / Inngest)
    // Example: await fetch(LANGGRAPH_URL, { method: 'POST', body: JSON.stringify(enrichedPayload) });
    console.log(`[Webhook][${channel}] Successfully resolved tenant ${tenantId}. Forwarding payload...`);

    return NextResponse.json({ success: true, tenant_id: tenantId }, { status: 200 });

  } catch (error) {
    console.error(`[Webhook] Fatal error in webhook handler:`, error);
    // Fail-safe: Returning 200 avoids infinite retries from webhook providers like Meta
    return NextResponse.json({ success: true, note: "Error processed safely" }, { status: 200 });
  }
}
