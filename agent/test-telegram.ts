import 'dotenv/config';
import fetch from 'node-fetch';

async function testTelegram() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  try {
    console.log(`Sending to chat: ${chatId} using bot token: ${botToken.slice(0, 5)}...`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🧪 Test message from Calcala agent'
      })
    });

    const data = await response.text();
    console.log(`Response Status: ${response.status}`);
    console.log(`Response Body: ${data}`);
  } catch (err) {
    console.error('Request failed:', err);
  }
}

testTelegram();
