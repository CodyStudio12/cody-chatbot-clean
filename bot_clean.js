// facebook-gpt-wedding-bot: Clean, robust, multi-user Messenger bot
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT || 3000;

if (!PAGE_ACCESS_TOKEN || !VERIFY_TOKEN) {
  console.error('Missing PAGE_ACCESS_TOKEN or VERIFY_TOKEN');
  app.get('/', (req, res) => res.status(500).send('Missing env vars'));
  app.listen(PORT, () => console.log('Bot running (env error) on port', PORT));
  return;
}

// In-memory user state, persisted to file
const MEMORY_FILE = 'memory.json';
let memory = {};
if (fs.existsSync(MEMORY_FILE)) {
  try { memory = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8')); } catch { memory = {}; }
}
function saveMemory() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

// Helper: send typing action
async function sendTyping(recipientId, action) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      { recipient: { id: recipientId }, sender_action: action });
  } catch (err) { console.error('sendTyping error:', err?.response?.data || err.message); }
}

// Helper: send message (text or image)
async function sendMessage(recipientId, message, imageUrl = null) {
  const messages = Array.isArray(message) ? message : [message];
  for (const msg of messages) {
    try {
      await sendTyping(recipientId, 'typing_on');
      const payload = {
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: imageUrl
          ? { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } }, metadata: 'from_bot' }
          : { text: msg, metadata: 'from_bot' },
      };
      await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, payload);
    } catch (err) {
      console.error('sendMessage error:', err?.response?.data || err.message);
    } finally {
      await sendTyping(recipientId, 'typing_off');
    }
  }
}

// Main logic: handle message for each user
async function handleMessage(senderId, messageText) {
  // Load or init user state
  let user = memory[senderId] || {
    date: null, location: null, type: null, hasSentPackages: false, sessionStarted: false, lastInteraction: Date.now()
  };
  user.lastInteraction = Date.now();
  const lower = messageText.toLowerCase();

  // Opening messages
  const OPENING_MESSAGES = [
    'hi', 'tư vấn giúp em', 'tư vấn', 'quay giá bao nhiêu', 'chụp giá bao nhiêu',
    'quay chụp giá bao nhiêu', 'em muốn hỏi gói quay chụp', 'em muốn tư vấn cưới',
    'cho em hỏi giá quay chụp'
  ];
  if (!user.sessionStarted && OPENING_MESSAGES.some(msg => lower.includes(msg))) {
    user.sessionStarted = true;
    memory[senderId] = user; saveMemory();
    await sendMessage(senderId, [
      'Hello Dâu nè ❤️ Cody cảm ơn vì đã nhắn tin ạ~',
      'Mình đã có **ngày tổ chức** chưa nhen?',
      'Và cho Cody xin luôn **địa điểm tổ chức** nha (SG hay ở tỉnh nè...)',
      'Lễ cưới của mình là sáng lễ chiều tiệc hay tiệc trưa ha.'
    ]);
    return;
  }

  // Regex nhận diện thông tin
  const LOCATION_REGEX = /(sài gòn|sg|hcm|long an|nhà bè|nha trang|vũng tàu|biên hòa|cần thơ|quận \d+|q\d+|bình thạnh|bình tân|tân bình|tân phú|đức hòa|đức huệ|cà mau|bến tre|vĩnh long|trà vinh|đồng tháp|ba tri)/i;
  const TYPE_REGEX = /(sáng lễ|chiều tiệc|tiệc trưa)/i;
  if (!user.date && /\d{1,2}[/\-]\d{1,2}([/\-]\d{2,4})?/.test(lower)) user.date = messageText;
  if (!user.location && LOCATION_REGEX.test(lower)) user.location = messageText;
  if (!user.type && TYPE_REGEX.test(lower)) user.type = messageText;
  memory[senderId] = user; saveMemory();

  // Hỏi tiếp nếu thiếu info
  const missing = [];
  if (!user.date) missing.push('**hỏi ngày tổ chức cưới** của mình luôn nè');
  if (!user.location) missing.push('**hỏi địa điểm tổ chức** luôn nha');
  if (!user.type) missing.push('**sáng lễ chiều tiệc hay tiệc trưa** luôn nha');
  if (missing.length > 0) {
    for (const msg of missing) await sendMessage(senderId, `Cho Cody xin ${msg}`);
    return;
  }

  // Đủ info, gửi gói ưu đãi 1 lần
  if (!user.hasSentPackages) {
    user.hasSentPackages = true;
    memory[senderId] = user; saveMemory();
    await sendMessage(senderId, [
      'Dạ, dưới đây là 3 gói ưu đãi của tháng bên em nhen ❤️',
      '🎁 **Package 1:** 2 máy quay + 2 máy chụp, giá 16.500.000đ\n👉 https://www.facebook.com/photo1',
      '🎁 **Package 2:** 1 máy quay + 2 máy chụp, giá 12.500.000đ\n👉 https://www.facebook.com/photo2',
      '🎁 **Package 3:** 1 máy quay + 1 máy chụp, giá 9.500.000đ\n👉 https://www.facebook.com/photo3'
    ]);
    return;
  }

  // Nếu không khớp logic nào, trả lời mềm mại
  await sendMessage(senderId, 'Mình đợi Cody 1 xíu nhen');
}

// Facebook webhook: nhận tin nhắn từ nhiều khách
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    await Promise.all(body.entry.map(async (entry) => {
      await Promise.all(entry.messaging.map(async (event) => {
        const senderId = event.sender.id;
        // Chỉ bỏ qua nếu là tin nhắn echo từ admin thật (có app_id)
        const isFromBot = event.message?.metadata === 'from_bot';
        const isEcho = event.message?.is_echo;
        const isAdminEcho = isEcho && !isFromBot && event.message?.app_id;
        if (isAdminEcho) return;
        if (event.message?.attachments && !isFromBot) {
          await sendMessage(senderId, 'Cody đã nhận được hình nha~');
          return;
        }
        // Không chặn theo recentReplies, luôn trả lời khách
        if (event.message && event.message.text && !isFromBot) {
          await handleMessage(senderId, event.message.text);
        }
      }));
    }));
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// Facebook webhook xác minh
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) res.status(200).send(challenge);
  else res.sendStatus(403);
});

app.listen(PORT, () => console.log(`Bot đang chạy ở cổng ${PORT}`));
