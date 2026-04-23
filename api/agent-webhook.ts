import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic Telegram Webhook Validation via Secret Token (if configured)
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secretToken) {
    const providedToken = req.headers['x-telegram-bot-api-secret-token'];
    if (providedToken !== secretToken) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
  }

  const update = req.body;

  // We are only interested in callback queries from inline buttons
  if (!update.callback_query) {
    return res.status(200).json({ ok: true });
  }

  const callbackQuery = update.callback_query;
  const data = callbackQuery.data as string;
  const message = callbackQuery.message;

  if (!data || !message) {
    return res.status(200).json({ ok: true });
  }

  const [action, id] = data.split('_');

  if ((action !== 'approve' && action !== 'reject') || !id) {
    return res.status(200).json({ ok: true });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!supabaseUrl || !supabaseKey || !botToken) {
    console.error('Missing required environment variables');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const newStatus = action === 'approve' ? 'published' : 'rejected';

  // Update Supabase
  const { error } = await supabase
    .from('articles')
    .update({ status: newStatus })
    .eq('id', id);

  let responseText = '';
  if (error) {
    console.error('Failed to update article status:', error);
    responseText = `❌ Error updating article to ${newStatus}`;
  } else {
    responseText = action === 'approve' ? '✅ Article Approved & Published!' : '❌ Article Rejected!';
  }

  // Edit Telegram message to remove buttons and show result
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: message.chat.id,
        message_id: message.message_id,
        text: `${message.text}\n\n*Status:* ${responseText}`,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [] } // Remove buttons
      })
    });

    // Answer callback query to stop loading state on user's button
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQuery.id,
        text: responseText
      })
    });

  } catch (err) {
    console.error('Failed to update Telegram message:', err);
  }

  return res.status(200).json({ ok: true });
}
