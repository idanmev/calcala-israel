import fetch from 'node-fetch';

export async function notifyTelegram(
  articleId: string,
  slug: string,
  title: string,
  metaDescription: string
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error('[NOTIFIER] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return;
  }

  const previewLink = `https://calcala-news.co.il/article.html?slug=${slug}`;
  
  const text = `
*New Article Draft* 📝

*Title:* ${title}
*Meta:* ${metaDescription}

[Preview Link](${previewLink})
  `.trim();

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `approve_${articleId}` },
        { text: '❌ Reject', callback_data: `reject_${articleId}` }
      ]
    ]
  };

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  console.log(`[NOTIFIER] Sending notification for article id: ${articleId}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Telegram API Error: ${response.status} - ${errorData}`);
    }
    
    console.log(`[NOTIFIER] Notification sent successfully.`);
  } catch (error) {
    console.error('[NOTIFIER] Failed to send Telegram notification:', error);
  }
}
