// === CẤU HÌNH ===
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT || 3000;

console.log('== Cody Studio Bot starting ==');
console.log('PORT:', PORT);
console.log('PAGE_ACCESS_TOKEN exists:', !!PAGE_ACCESS_TOKEN);
console.log('VERIFY_TOKEN exists:', !!VERIFY_TOKEN);

if (!PAGE_ACCESS_TOKEN || !VERIFY_TOKEN) {
  console.error("Missing env vars: PAGE_ACCESS_TOKEN or VERIFY_TOKEN");
  // Để Render không bị timeout port scan, vẫn cho app listen nhưng báo lỗi rõ ràng
  app.get('/', (req, res) => {
    res.status(500).send('Missing PAGE_ACCESS_TOKEN or VERIFY_TOKEN. Check environment variables.');
  });
  app.listen(PORT, () => console.log(`Bot đang chạy ở cổng ${PORT} (env error)`));
  // Không exit(1) để Render detect port
} else {
  // ...existing code...
// === BỘ NHỚ TẠM ===

let memory = {}; // Lưu info từng khách
let recentReplies = {}; // Đánh dấu tin đã được admin trả lời
const MEMORY_FILE = "memory.json";
const REPLIES_FILE = "recentReplies.json";

// Đọc memory
if (fs.existsSync(MEMORY_FILE)) {
  try {
    memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    memory = {};
  }
}
// Đọc recentReplies
if (fs.existsSync(REPLIES_FILE)) {
  try {
    recentReplies = JSON.parse(fs.readFileSync(REPLIES_FILE, "utf8"));
  } catch {
    recentReplies = {};
  }
}

// Debounce/throttle saveMemory
let memorySaveTimeout = null;
function saveMemory() {
  if (memorySaveTimeout) clearTimeout(memorySaveTimeout);
  memorySaveTimeout = setTimeout(() => {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
  }, 2000); // Ghi sau 2s
}

let repliesSaveTimeout = null;
function saveReplies() {
  if (repliesSaveTimeout) clearTimeout(repliesSaveTimeout);
  repliesSaveTimeout = setTimeout(() => {
    fs.writeFileSync(REPLIES_FILE, JSON.stringify(recentReplies, null, 2));
  }, 2000);
}

function clearStaleUsers() {
  const now = Date.now();
  for (const [id, data] of Object.entries(memory)) {
    if (data.lastInteraction && now - data.lastInteraction > 24 * 60 * 60 * 1000) {
      delete memory[id];
    }
  }
}
async function sendTyping(recipientId, action) {
  try {
    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, { recipient: { id: recipientId }, sender_action: action });
  } catch (err) {
    console.error('sendTyping error:', err?.response?.data || err.message);
  }
}

// === PROMPT ĐỊNH HƯỚNG ===
const SYSTEM_PROMPT = `Bạn là chatbot tư vấn dịch vụ cưới của Cody Studio. Khi nói chuyện với khách, bạn luôn xưng "Cody" và gọi khách là "mình" hoặc "em/chị/anh" một cách tự nhiên, thân thiện. Hãy giữ ngôn ngữ mềm mại, nhẹ nhàng và rõ ràng như cách một nhân viên tư vấn dày dạn kinh nghiệm trò chuyện với cô dâu chú rể sắp cưới, không tư vấn những gì mình không biết. Đừng trả lời nếu admin đã phản hồi.`;

// === HỖ TRỢ GỬI TIN NHẮN ===
async function sendMessage(recipientId, message, imageUrl = null) {
  const messages = Array.isArray(message) ? message : [message];
  for (const msg of messages) {
    try {
      await sendTyping(recipientId, "typing_on");
      const payload = {
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: imageUrl
          ? {
              attachment: {
                type: 'image',
                payload: { url: imageUrl, is_reusable: true },
              },
                metadata: "from_bot",
            }
          : { text: msg, metadata: 'from_bot' },
      };
      await axios.post(
        `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        payload
      );
    } catch (err) {
      console.error('sendMessage error:', err?.response?.data || err.message);
    } finally {
      await sendTyping(recipientId, "typing_off");
    }
  }
}

// === PHÂN TÍCH NỘI DUNG VÀ TRẢ LỜI ===
async function handleMessage(senderId, messageText) {
  clearStaleUsers();
  const user = memory[senderId] || { date: null, location: null, type: null, hasSentPackages: false, sessionStarted: false, lastInteraction: Date.now() };
  user.lastInteraction = Date.now();
  const lower = messageText.toLowerCase();

  const OPENING_MESSAGES = [
    "hi", "tư vấn giúp em", "tư vấn", "quay giá bao nhiêu", "chụp giá bao nhiêu",
    "quay chụp giá bao nhiêu", "em muốn hỏi gói quay chụp", "em muốn tư vấn cưới",
    "cho em hỏi giá quay chụp"
  ];

  // Gặp tin nhắn mở đầu
  if (!user.sessionStarted && OPENING_MESSAGES.some(msg => lower.includes(msg))) {
    user.sessionStarted = true;
        memory[senderId] = user;
    saveMemory();

    await sendMessage(senderId, "Hello Dâu nè ❤️ Cody cảm ơn vì đã nhắn tin ạ~");
    await sendMessage(senderId, "Mình đã có **ngày tổ chức** chưa nhen?");
    await sendMessage(senderId, "Và cho Cody xin luôn **địa điểm tổ chức** nha (SG hay ở tỉnh nè...)");
    await sendMessage(senderId, "Lễ cưới của mình là sáng lễ chiều tiệc hay tiệc trưa ha.");
    return;
  }

  // Nhận thông tin từ câu trả lời

  // Tách regex location/type ra file riêng nếu muốn mở rộng, ở đây tạm để biến riêng
  const LOCATION_REGEX = /(sài gòn|sg|hcm|long an|nhà bè|nha trang|vũng tàu|biên hòa|cần thơ|quận \d+|q\d+|bình thạnh|bình tân|tân bình|tân phú|đức hòa|đức huệ|cà mau|bến tre|vĩnh long|trà vinh|đồng tháp|ba tri)/i;
  const TYPE_REGEX = /(sáng lễ|chiều tiệc|tiệc trưa)/i;

  if (!user.date && /\d{1,2}[/\-]\d{1,2}([/\-]\d{2,4})?/.test(lower)) user.date = messageText;
  if (!user.location && LOCATION_REGEX.test(lower)) user.location = messageText;
  if (!user.type && TYPE_REGEX.test(lower)) user.type = messageText;

    memory[senderId] = user;
    saveMemory();
  // Nếu chưa đủ info → hỏi tiếp cái thiếu
  const missing = [];
  if (!user.date) missing.push("**hỏi ngày tổ chức cưới** của mình luôn nè");
  if (!user.location) missing.push("**hỏi địa điểm tổ chức** luôn nha");
  if (!user.type) missing.push("**sáng lễ chiều tiệc hay tiệc trưa** luôn nha");

  if (missing.length > 0) {
    for (const msg of missing) await sendMessage(senderId, `Cho Cody xin ${msg}`);
    return;
  }

  // Nếu đủ info → gửi gói ưu đãi
  if (!user.hasSentPackages) {
    user.hasSentPackages = true;
    memory[senderId] = user;
    saveMemory();

    await sendMessage(senderId, 'Dạ, dưới đây là 3 gói ưu đãi của tháng bên em nhen ❤️');
    await sendMessage(senderId, '🎁 **Package 1:** 2 máy quay + 2 máy chụp, giá 16.500.000đ\n👉 https://www.facebook.com/photo1');
    await sendMessage(senderId, '🎁 **Package 2:** 1 máy quay + 2 máy chụp, giá 12.500.000đ\n👉 https://www.facebook.com/photo2');
    await sendMessage(senderId, '🎁 **Package 3:** 1 máy quay + 1 máy chụp, giá 9.500.000đ\n👉 https://www.facebook.com/photo3');
    return;
  }

  // Nếu không khớp logic nào, chỉ gửi tin "Mình đợi Cody 1 xíu nhen" nhưng không đánh dấu admin, không chặn khách nhắn tiếp
  await sendMessage(senderId, 'Mình đợi Cody 1 xíu nhen');
  // Không return ở đây, để khách vẫn có thể nhắn tiếp và bot vẫn trả lời các tin tiếp theo
}

// === NHẬN WEBHOOK TỪ FACEBOOK ===
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    await Promise.all(body.entry.map(async (entry) => {
      await Promise.all(entry.messaging.map(async (event) => {
        const senderId = event.sender.id;
        // Cải tiến: KHÔNG tự động đánh dấu admin nếu chỉ dựa vào is_echo và thiếu metadata
        // Chỉ đánh dấu là admin nếu có app_id (tức là do admin thật gửi qua page inbox, không phải do bot)
        const isFromBot = event.message?.metadata === 'from_bot';
        const isEcho = event.message?.is_echo;
        const isAdminEcho = isEcho && !isFromBot && event.message?.app_id;

        if (isAdminEcho) {
          // Chỉ log và đánh dấu admin khi thực sự có app_id (admin thật gửi)
          console.log(`[ADMIN REPLY DETECTED - app_id] senderId: ${senderId}, message:`, event.message);
          recentReplies[senderId] = "admin";
          saveReplies();
          return;
        }

        // Nếu là file/hình ảnh gửi lên từ khách
        if (event.message?.attachments && !isFromBot) {
          await sendMessage(senderId, "Cody đã nhận được hình nha~");
          return;
        }

        // Nếu đã bị đánh dấu là admin thì không trả lời nữa
        // Tạm thời bỏ chặn này để debug, luôn cho bot trả lời
        // if (recentReplies[senderId] === 'admin') return;

        // Nếu vừa trả lời trong 10 phút thì không trả lời tiếp
        if (recentReplies[senderId] && typeof recentReplies[senderId] === 'number' && Date.now() - recentReplies[senderId] < 10 * 60 * 1000)
          return;

        // Nếu là tin nhắn text từ khách (không phải bot, không phải admin)
        if (event.message && event.message.text && !isFromBot) {
          recentReplies[senderId] = Date.now();
          saveReplies();
          await handleMessage(senderId, event.message.text);
        }
      }));
    }));
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
}