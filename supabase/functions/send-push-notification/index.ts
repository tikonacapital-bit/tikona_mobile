import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import webpush from 'npm:web-push';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { company_name, nse_symbol, rating, cmp, target_price, upside_pct, validity_type, validity_date, session_id, plans } = await req.json();

    if (!company_name || !plans) {
      throw new Error('Missing required fields: company_name or plans');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables not set');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get all active subscriptions for the specified plans (and all_in_growth)
    const targetPlans = [...plans, 'all_in_growth'];
    
    // Fetch all active subscribers matching the plans.
    const { data: subs, error: subsError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('is_active', true)
      .in('plan', targetPlans);

    if (subsError) throw subsError;

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active subscribers found for these plans.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get unique user IDs
    const userIds = [...new Set(subs.map(s => s.user_id))];

    // 2. Get push tokens for these users
    // Chunk the .in query to avoid URI too long or DB query limits
    let tokens: string[] = [];
    
    for (let i = 0; i < userIds.length; i += 200) {
      const chunk = userIds.slice(i, i + 200);
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('expo_push_token')
        .in('user_id', chunk)
        .not('expo_push_token', 'is', null);

      if (profError) {
        console.error('Error fetching profiles:', profError);
        continue;
      }

      if (profiles) {
        tokens.push(...profiles.map(p => p.expo_push_token).filter(Boolean));
      }
    }

    // Remove duplicate tokens
    tokens = [...new Set(tokens)];

    if (tokens.length === 0) {
       return new Response(
        JSON.stringify({ message: 'No push tokens found for active subscribers.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 3. Construct Expo push messages
    let titleText = `New Recommendation: ${company_name} (${nse_symbol})`;
    let bodyText = `Tap to view the detailed research report and thesis on ${company_name}.`;
    if (rating) {
        bodyText = `Rating: ${rating}. ${bodyText}`;
    }

    if (nse_symbol && cmp !== undefined && cmp !== null && rating && target_price !== undefined && target_price !== null) {
      const direction = target_price >= cmp ? 'Upside' : 'Downside';
      const pctVal = upside_pct !== null && upside_pct !== undefined ? Math.round(Math.abs(upside_pct)) : Math.round(Math.abs(((target_price - cmp) / cmp) * 100));
      let valType = '1Y';
      if (validity_type === 'custom') {
        valType = 'Custom';
      } else if (validity_type) {
        valType = validity_type.replace('_year', 'Y').toUpperCase();
      }
      titleText = `${nse_symbol}: ${rating} @ INR ${cmp} | TP: ${target_price}`;
      bodyText = `${direction} ${pctVal}% in ${valType}. Tap to View, Chat and Listen to detailed Investment thesis`;
    }

    const expoMessages = [];
    const webSubscriptions = [];

    for (let pushToken of tokens) {
      if (pushToken.includes('ExponentPushToken[')) {
        expoMessages.push({
          to: pushToken,
          sound: 'default',
          title: titleText,
          body: bodyText,
          data: session_id ? { url: `tikonamobile://report/${session_id}` } : undefined,
        });
      } else if (pushToken.startsWith('{')) {
        try {
          const sub = JSON.parse(pushToken);
          if (sub && sub.endpoint) {
            webSubscriptions.push(sub);
          }
        } catch(e) {
          // ignore parsing error
        }
      }
    }

    let successCount = 0;

    // 4. Send to Expo in chunks of 100 (Expo API limit)
    const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
    
    for (let i = 0; i < expoMessages.length; i += 100) {
      const chunk = expoMessages.slice(i, i + 100);
      try {
        const res = await fetch(EXPO_PUSH_API_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });
        const data = await res.json();
        console.log(`Expo Push API response (chunk ${i}):`, data);
        successCount += chunk.length;
      } catch (err) {
        console.error(`Error sending chunk ${i}:`, err);
      }
    }

    // 5. Send Web Push notifications
    if (webSubscriptions.length > 0) {
      webpush.setVapidDetails(
        'mailto:support@tikonacapital.com',
        'BNFaeucr4cV7X1MsqUWfG0BvtyMvKJpprkQj_x7e33uIphcP5A69S3juDUHYHcefkImFoIfHUbpehK50XNwXktc',
        Deno.env.get('VAPID_PRIVATE_KEY') || 'yIBwVqsut6L6nqYjoFEu05PbzOszQVTO_C2iRMXDmVk'
      );

      const webPayload = JSON.stringify({
        title: titleText,
        body: bodyText,
        data: session_id ? { url: `tikonamobile://report/${session_id}` } : undefined
      });

      for (const sub of webSubscriptions) {
        try {
          await webpush.sendNotification(sub, webPayload);
          successCount++;
        } catch (err) {
          console.error('Web push error:', err);
        }
      }
    }

    return new Response(
      JSON.stringify({ message: `Successfully sent ${successCount} notifications.`, total_subscribers: userIds.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
