// === CẤU HÌNH ===
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT || 3000;

// === BỘ NHỚ TẠM ===
const memory = {}; // Lưu info từng khách
const recentReplies = {}; // Đánh dấu tin đã được admin trả lời

// === PROMPT ĐỊNH HƯỚNG ===
const SYSTEM_PROMPT = `Bạn là chatbot tư vấn dịch vụ cưới của Cody Studio. Khi nói chuyện với khách, bạn luôn xưng "Cody" và gọi khách là "mình" hoặc "em/chị/anh" một cách tự nhiên, thân thiện. Hãy giữ ngôn ngữ mềm mại, nhẹ nhàng và rõ ràng như cách một nhân viên tư vấn dày dạn kinh nghiệm trò chuyện với cô dâu chú rể sắp cưới, không tư vấn những gì mình không biết. Đừng trả lời nếu admin đã phản hồi.`;

// === HỖ TRỢ GỬI TIN NHẮN ===
async function sendMessage(recipientId, message, imageUrl = null) {
  const messages = Array.isArray(message) ? message : [message];
  for (let msg of messages) {
    const payload = {
      messaging_type: 'RESPONSE',
      recipient: { id: recipientId },
      message: imageUrl
        ? { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } }
        : { text: msg },
    };
    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, payload);
  }
}

// === PHÂN TÍCH NỘI DUNG VÀ TRẢ LỜI ===
async function handleMessage(senderId, messageText) {
  const user = memory[senderId] || { date: null, location: null, hasSentPackages: false, sessionStarted: false };
  const lower = messageText.toLowerCase();

  const OPENING_MESSAGES = [
    "hi",
    "tư vấn giúp em",
    "tư vấn",
    "quay giá bao nhiêu",
    "chụp giá bao nhiêu",
    "quay chụp giá bao nhiêu",
    "em muốn hỏi gói quay chụp",
    "em muốn tư vấn cưới",
    "cho em hỏi giá quay chụp"
  ];

  if (!user.sessionStarted && OPENING_MESSAGES.some(msg => lower.includes(msg))) {
    user.sessionStarted = true;
    memory[senderId] = user;
    await sendMessage(senderId, "Hello Dâu nè ❤️ Cody cảm ơn vì đã nhắn tin ạ~");
    await sendMessage(senderId, "Mình đã có **ngày tổ chức** chưa nhen?");
    await sendMessage(senderId, "Và cho Cody xin luôn **địa điểm tổ chức** nha (SG hay ở tỉnh nè...)");
    await sendMessage(senderId, "Lễ cưới của mình là sáng lễ chiều tiệc hay tiệc trưa ha.");
    return;
  }

  if (!user.date && /\d{1,2}[/\-]\d{1,2}([/\-]\d{2,4})?/.test(lower)) user.date = messageText;
  if (!user.location && /(sài gòn|sg|hcm|long an|nhà bè|nha trang|vũng tàu|biên hòa|cần thơ|quận 1|q1|quận 2|q2|quận 3|q3|quận 4|q4|quận 5|q5|quận 6|q6|quận 7|q7|quận 8|q8|quận 9|q9|quận 10|q10|quận 11|q11|quận 12|q12|bình thạnh|bình tân|tân bình|tân phú|nhà bè|đức hòa|đức huệ|cần thơ|cà mau|bến tre|vĩnh long|trà vinh|đồng tháp|vũng tàu|ba tri|)/i.test(lower)) user.location = messageText;

  memory[senderId] = user;

  if (!user.date) return sendMessage(senderId, 'Mình note lại nha. Cho mình xin **ngày tổ chức cưới** của mình luôn nè');
  if (!user.location) return sendMessage(senderId, 'Cảm ơn mình nhiều nhen. Cho mình xin thêm **địa điểm tổ chức** luôn nha');

  if (!user.hasSentPackages) {
    user.hasSentPackages = true;
    memory[senderId] = user;
    await sendMessage(senderId, 'Dạ, dưới đây là 3 gói ưu đãi của tháng bên em nhen ❤️');
    // các gói ưu đãi giữ nguyên như trong file
  }
}

// === NHẬN WEBHOOK TỪ FACEBOOK ===
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    for (const entry of body.entry) {
      for (const event of entry.messaging) {
        const senderId = event.sender.id;

        if (event.message?.is_echo) {
          recentReplies[senderId] = 'admin';
          continue;
        }

        if (recentReplies[senderId] === 'admin') continue;

        if (recentReplies[senderId] && Date.now() - recentReplies[senderId] < 10 * 60 * 1000) continue;

        if (event.message && event.message.text) {
          recentReplies[senderId] = Date.now();
          try {
            await handleMessage(senderId, event.message.text);
          } catch (err) {
            await sendMessage(senderId, 'Mình đợi Cody 1 xíu nhen');
          }
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// === XÁC MINH WEBHOOK ===
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) res.status(200).send(challenge);
  else res.sendStatus(403);
});

app.listen(PORT, () => console.log(`Bot đang chạy ở cổng ${PORT}`));