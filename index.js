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
  // 1. Sameday Edit là gì
  if (/sameday edit là gì|sde là gì/i.test(lower)) {
    await sendMessage(senderId, 'Sameday Edit là 1 video ngắn 3-4p của buổi sáng gia tiên để chiếu vào tiệc tối nhen');
    return;
  }

  // 2. Đi tỉnh không hoặc nhà em ở tỉnh (chưa rõ tỉnh)
  if (/(bên anh có nhận đi tỉnh|nhà em ở tỉnh|em ở tỉnh|đi tỉnh không)/i.test(lower) && !/(sài gòn|sg|hcm|long an|nhà bè|nha trang|vũng tàu|biên hòa|cần thơ|quận \d+|q\d+|bình thạnh|bình tân|tân bình|tân phú|đức hòa|đức huệ|cà mau|bến tre|vĩnh long|trà vinh|đồng tháp|ba tri)/i.test(lower)) {
    await sendMessage(senderId, 'Em ở đâu em ha?');
    return;
  }

  // 4. Đặt trong tháng này mới có ưu đãi ha anh?
  if (/đặt trong tháng.*(mới có|mới được).*ưu đãi|ưu đãi.*trong tháng/i.test(lower)) {
    let xungHo = 'Dâu';
    if (/anh\b/.test(lower)) xungHo = 'anh';
    if (/chị\b/.test(lower)) xungHo = 'chị';
    await sendMessage(senderId, `Đúng rồi ${xungHo}/anh/chị, mình đặt sớm để giữ ngày, block team và block ưu đãi luôn á`);
    return;
  }

  // 5. Phí đi lại/di chuyển
  if (/(phí đi lại|phí di chuyển|phí xe|phí khách sạn|phí phát sinh)/i.test(lower)) {
    if (user.location && /(sài gòn|sg|hcm)/i.test(user.location)) {
      await sendMessage(senderId, 'Nếu ở SG thì không có em nè');
    } else {
      await sendMessage(senderId, 'Mình phát sinh thêm phí đi lại xe khách và khách sạn cho team nè, được tặng phần chi phí phát sinh đi tỉnh');
    }
    return;
  }

  // 6. Lễ nhà thờ/hôn phối trong ngày cưới
  if (/(lễ nhà thờ|hôn phối).*phát sinh.*không|có phát sinh.*lễ nhà thờ|có phát sinh.*hôn phối/i.test(lower) && /trong ngày|trong ngày cưới|cùng ngày/i.test(lower)) {
    await sendMessage(senderId, 'Không phát sinh nếu tổ chức trong ngày cưới nhen');
    return;
  }

  // 7. Lễ nhà thờ tách ngày
  if (/(lễ nhà thờ|hôn phối).*tách ngày|ngày khác|khác ngày/i.test(lower)) {
    await sendMessage(senderId, 'Em cho anh xin lịch trình chi tiết nhé');
    user.waitingForSchedule = true;
    memory[senderId] = user; saveMemory();
    return;
  }
  if (user.waitingForSchedule) {
    await sendMessage(senderId, 'Em đợi anh xíu nhen');
    user.agentBlockedUntil = Date.now() + 30 * 60 * 1000;
    user.waitingForSchedule = false;
    memory[senderId] = user; saveMemory();
    return;
  }

  // 8. Để em bàn lại với chồng/em hỏi ý thêm gia đình
  if (/để em bàn lại với chồng|em hỏi ý.*gia đình|em hỏi ý thêm gia đình/i.test(lower)) {
    await sendMessage(senderId, 'Okiee em nè, có gì báo Cody sớm nhen để block ngày và ưu đãi cho em á, do ưu đãi sắp hết rùi');
    return;
  }

  // 9. Cho em book hoặc em muốn book gói package 1/2/3
  if (/cho em book|em muốn book|em muốn book gói|em muốn book package|em muốn đặt gói|em muốn đặt package|em muốn book gói package/i.test(lower)) {
    await sendMessage(senderId, 'Em đợi xíu anh check cho em nhen');
    user.agentBlockedUntil = Date.now() + 30 * 60 * 1000;
    memory[senderId] = user; saveMemory();
    return;
  }

  // 10. Xin giá quay/chụp 1 buổi
  if (/giá.*1 buổi|giá quay 1 buổi|giá chụp 1 buổi|giá 1 buổi chụp|giá 1 buổi quay|giá 1 buổi|giá quay chụp 1 buổi|giá 1 buổi chụp hình quay phim|giá 1 buổi quay phim chụp hình/i.test(lower)) {
    await sendMessage(senderId, 'Mình cần quay chụp lễ hay tiệc nè?');
    if (!user.date) await sendMessage(senderId, 'Cho Cody xin ngày tổ chức luôn nha');
    if (!user.location) await sendMessage(senderId, 'Cho Cody xin địa điểm tổ chức luôn nha');
    user.agentBlockedUntil = Date.now() + 30 * 60 * 1000;
    memory[senderId] = user; saveMemory();
    return;
  }

  // 3. Sau khi gửi 3 gói package, nhắn thêm ưu đãi
  if (user.hasSentPackages && !user.hasSentUuDai) {
    await sendMessage(senderId, 'Ba gói này bên anh đang có ưu đãi trong tháng, hiện tại còn vài slot cuối thui à');
    user.hasSentUuDai = true;
    memory[senderId] = user; saveMemory();
    // Không return, để tránh chặn các reply tiếp theo
  }
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

  // Nếu không khớp logic nào, kiểm tra block reply 3 ngày hoặc 30 phút sau agent
  const now = Date.now();
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
  const THIRTY_MINUTES = 30 * 60 * 1000;
  if ((user.blockedUntil && now < user.blockedUntil) || (user.agentBlockedUntil && now < user.agentBlockedUntil)) {
    // Đang bị block, không trả lời nữa
    return;
  }
  // Gửi tin nhắn và block reply 3 ngày
  await sendMessage(senderId, 'Mình đợi Cody 1 xíu nhen');
  user.blockedUntil = now + THREE_DAYS;
  memory[senderId] = user; saveMemory();
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
        // Nếu là agent (không phải bot) nhắn thì block bot 30 phút
        if (isEcho && !isFromBot && !isAdminEcho) {
          // Block bot 30 phút không trả lời khách này
          let user = memory[senderId] || {};
          const now = Date.now();
          const THIRTY_MINUTES = 30 * 60 * 1000;
          user.agentBlockedUntil = now + THIRTY_MINUTES;
          memory[senderId] = user; saveMemory();
          return;
        }
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
