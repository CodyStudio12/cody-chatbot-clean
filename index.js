// facebook-gpt-wedding-bot: Clean, robust, multi-user Messenger bot
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const OpenAI = require('openai');
const app = express();
app.use(express.json());


const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

// OpenAI config
let openai = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
}

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


// Helper: call OpenAI GPT-4.1 Turbo
async function callOpenAI(history, userMsg) {
  if (!openai) return 'Bot chưa cấu hình OpenAI API.';
  const messages = [
    {
      role: 'system',
      content:
        'Bạn là Cody, chuyên gia tư vấn dịch vụ quay phim và chụp hình NGÀY CƯỚI của Cody Studio. Chỉ nhận tư vấn quay & chụp NGÀY CƯỚI (lễ gia tiên, lễ rước dâu, tiệc cưới), KHÔNG nhận pre-wedding, không nhận chụp ngoại cảnh, không nhận chụp concept, không nhận chụp studio, không nhận chụp ảnh cưới trước ngày cưới. Nếu khách hỏi về pre-wedding, ngoại cảnh, concept, studio, hãy trả lời lịch sự: "Cody Studio chỉ nhận quay chụp NGÀY CƯỚI (lễ gia tiên, tiệc cưới), không nhận pre-wedding, không nhận chụp ngoại cảnh, không nhận chụp concept, không nhận chụp studio bạn nha!". Luôn xưng hô thân thiện (em/anh/chị/Dâu), hỏi gợi mở về ngày tổ chức, địa điểm, loại lễ. Không spam, không lặp lại, không trả lời ngoài chủ đề NGÀY CƯỚI. Trả lời tự nhiên, ngắn gọn, không lặp lại prompt, không nhắc lại "Cody Studio" hay "chỉ nhận quay chụp ngày cưới" nếu khách không hỏi về pre-wedding. Không tự giới thiệu lại về Cody Studio. Không trả lời máy móc, không lặp lại nội dung hệ thống, và không quá dài dòng, sử dụng emoji và mỗi câu hỏi luôn là 1 tin nhắn riêng, để giống người hơn.'
    },
    // Few-shot examples for style
    {
      role: 'user',
      content: 'Hi'
    },
    {
      role: 'user',
      content: 'Tư vấn'
    },
    {
      role: 'user',
      content: 'Cần tư vấn'
    },
    {
      role: 'assistant',
      content: 'Hello Dâu nè ❤️ Cody cảm ơn vì đã nhắn tin ạ~'
    },
    {
      role: 'assistant',
      content: 'Mình đã có ngày tổ chức chưa nhen?'
    },
    {
      role: 'assistant',
      content: 'Cho Cody xin luôn địa điểm tổ chức nha (SG hay ở tỉnh nè...) Lễ cưới của mình là sáng lễ chiều tiệc hay tiệc trưa ha.'
    },
    {
      role: 'user',
      content: 'Bên em có nhận đi tỉnh không?'
    },
    {
      role: 'assistant',
      content: 'Em ở đâu em ha? Cody nhận đi tỉnh nha, chỉ cần cho Cody xin địa điểm cụ thể để tư vấn kỹ hơn nè.'
    },
    {
      role: 'user',
      content: 'Để em hỏi ý thêm gia đình rồi báo lại sau.'
    },
    {
      role: 'assistant',
      content: 'Okiee em nè, có gì báo Cody sớm nhen để block ngày và ưu đãi cho em á, do ưu đãi sắp hết rùi.'
    },
    // End few-shot
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMsg }
  ];
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages,
      max_tokens: 300,
      temperature: 0.7
    });
    return res.choices[0].message.content.trim();
  } catch (e) {
    // Log chi tiết lỗi OpenAI để debug trên Render
    if (e.response) {
      console.error('OpenAI API error:', e.response.status, e.response.data);
    } else {
      console.error('OpenAI API error:', e.message || e);
    }
    return 'Xin lỗi, hiện tại bot không kết nối được GPT.';
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

  // --- Nhận diện info, hỏi tiếp info, gửi ưu đãi, ưu tiên package ---
  // Regex nhận diện thông tin (khai báo 1 lần ở đầu hàm)
  if (!user.LOCATION_REGEX) user.LOCATION_REGEX = /(sài gòn|sg|hcm|long an|nhà bè|nha trang|vũng tàu|biên hòa|cần thơ|quận \d+|q\d+|bình thạnh|bình tân|tân bình|tân phú|đức hòa|đức huệ|cà mau|bến tre|vĩnh long|trà vinh|đồng tháp|ba tri)/i;
  if (!user.TYPE_REGEX) user.TYPE_REGEX = /(sáng lễ|chiều tiệc|tiệc trưa)/i;
  if (!user.date && /\d{1,2}[/\-]\d{1,2}([/\-]\d{2,4})?/.test(lower)) user.date = messageText;
  if (!user.location && user.LOCATION_REGEX.test(lower)) user.location = messageText;
  if (!user.type && user.TYPE_REGEX.test(lower)) user.type = messageText;
  memory[senderId] = user; saveMemory();

  // Luôn để GPT hỏi info tự nhiên trước, chỉ gửi 3 package khi đã đủ info
  let missing = [];
  if (!user.date) missing.push('date');
  if (!user.location) missing.push('location');
  if (!user.type) missing.push('type');
  if (missing.length > 0) {
    // Gọi GPT để hỏi info tự nhiên, không hỏi cứng
    if (!user.gptHistory) user.gptHistory = [];
    let gptHistoryForCall = [...user.gptHistory, { role: 'user', content: messageText }];
    let gptReply = await callOpenAI(gptHistoryForCall, messageText);
    // Nếu GPT trả lời quá ngắn hoặc không tự nhiên thì fallback
    if (!gptReply || gptReply.length < 10) {
      gptReply = 'Cody cảm ơn bạn đã nhắn tin! Bạn có thể cho Cody biết thêm về ngày tổ chức, địa điểm hoặc mong muốn của mình không ạ?';
    }
    user.gptHistory.push({ role: 'user', content: messageText });
    const replyParts = gptReply.split(/\n+/).map(s => s.trim()).filter(Boolean);
    for (const part of replyParts) {
      user.gptHistory.push({ role: 'assistant', content: part });
      await sendMessage(senderId, part);
    }
    memory[senderId] = user; saveMemory();
    return;
  }

  // Ưu tiên nhận diện yêu cầu package cụ thể (1 quay 1 chụp, 2 quay 2 chụp, ...)
  if (/1\s*quay.*1\s*chụp|1\s*chụp.*1\s*quay/i.test(lower)) {
    // Gói 1 quay 1 chụp (Package 3)
    await sendMessage(senderId, 'Dạ, gói **1 máy quay + 1 máy chụp** (Package 3) bên em giá 9.500.000đ, đã bao gồm quay phim phóng sự và chụp hình phóng sự (hỗ trợ chụp thêm hình TT) trọn ngày cưới nha!');
    await sendMessage(senderId, null, 'https://i.postimg.cc/hPMwbd8x/2.png');
    await sendMessage(senderId, 'Ngoài ra, bên em còn 2 gói cao hơn nếu mình cần nhiều máy hơn, Cody gửi luôn để mình tham khảo nhé:');
    await sendMessage(senderId, '🎁 **Package 1:** 2 máy quay + 2 máy chụp, giá 16.500.000đ');
    await sendMessage(senderId, null, 'https://i.postimg.cc/Gm4VhfkS/Peach-Modern-Wedding-Save-the-Date-Invitation-1.png');
    await sendMessage(senderId, '🎁 **Package 2:** 1 máy quay + 2 máy chụp, giá 12.500.000đ');
    await sendMessage(senderId, null, 'https://i.postimg.cc/prJNtnMQ/1.png');
    user.hasSentPackages = true;
    memory[senderId] = user; saveMemory();
    return;
  }
  if (/2\s*quay.*2\s*chụp|2\s*chụp.*2\s*quay/i.test(lower)) {
    // Gói 2 quay 2 chụp (Package 1)
    await sendMessage(senderId, 'Dạ, gói **2 máy quay + 2 máy chụp** (Package 1) bên em giá 16.500.000đ, full ekip quay chụp trọn ngày cưới luôn nha!');
    await sendMessage(senderId, null, 'https://i.postimg.cc/Gm4VhfkS/Peach-Modern-Wedding-Save-the-Date-Invitation-1.png');
    await sendMessage(senderId, 'Ngoài ra, bên em còn 2 gói nhẹ hơn nếu mình muốn tiết kiệm chi phí, Cody gửi luôn để mình tham khảo nhé:');
    await sendMessage(senderId, '🎁 **Package 2:** 1 máy quay + 2 máy chụp, giá 12.500.000đ');
    await sendMessage(senderId, null, 'https://i.postimg.cc/prJNtnMQ/1.png');
    await sendMessage(senderId, '🎁 **Package 3:** 1 máy quay + 1 máy chụp, giá 9.500.000đ');
    await sendMessage(senderId, null, 'https://i.postimg.cc/hPMwbd8x/2.png');
    user.hasSentPackages = true;
    memory[senderId] = user; saveMemory();
    return;
  }
  if (/1\s*quay.*2\s*chụp|2\s*chụp.*1\s*quay|1\s*chụp.*2\s*quay|2\s*quay.*1\s*chụp/i.test(lower)) {
    // Gói 1 quay 2 chụp (Package 2)
    await sendMessage(senderId, 'Dạ, gói **1 máy quay + 2 máy chụp** (Package 2) bên em giá 12.500.000đ, phù hợp cho lễ cưới đông khách hoặc muốn nhiều góc chụp đẹp nha!');
    await sendMessage(senderId, null, 'https://i.postimg.cc/prJNtnMQ/1.png');
    await sendMessage(senderId, 'Ngoài ra, bên em còn 2 gói khác để mình tham khảo thêm:');
    await sendMessage(senderId, '🎁 **Package 1:** 2 máy quay + 2 máy chụp, giá 16.500.000đ');
    await sendMessage(senderId, null, 'https://i.postimg.cc/Gm4VhfkS/Peach-Modern-Wedding-Save-the-Date-Invitation-1.png');
    await sendMessage(senderId, '🎁 **Package 3:** 1 máy quay + 1 máy chụp, giá 9.500.000đ');
    await sendMessage(senderId, null, 'https://i.postimg.cc/hPMwbd8x/2.png');
    user.hasSentPackages = true;
    memory[senderId] = user; saveMemory();
    return;
  }

  // Đủ info, gửi gói ưu đãi 1 lần (chỉ gửi khi đã đủ info)
  if (user.date && user.location && user.type && !user.hasSentPackages) {
    // Đảm bảo không bị block bởi agentBlockedUntil hoặc các trạng thái khác
    if (user.agentBlockedUntil && Date.now() < user.agentBlockedUntil) {
      return;
    }
    user.hasSentPackages = true;
    memory[senderId] = user; saveMemory();
    await sendMessage(senderId, 'Dạ, dưới đây là 3 gói ưu đãi của tháng này nhen, nhiều phần quà tặng kèm và số lượng có hạn nè ❤️');
    // Package 1
    await sendMessage(senderId, '🎁 **Package 1:** 2 máy quay + 2 máy chụp, giá 16.500.000đ');
    await sendMessage(senderId, null, 'https://i.postimg.cc/Gm4VhfkS/Peach-Modern-Wedding-Save-the-Date-Invitation-1.png');
    // Package 2
    await sendMessage(senderId, '🎁 **Package 2:** 1 máy quay + 2 máy chụp, giá 12.500.000đ');
    await sendMessage(senderId, null, 'https://i.postimg.cc/prJNtnMQ/1.png');
    // Package 3
    await sendMessage(senderId, '🎁 **Package 3:** 1 máy quay + 1 máy chụp, giá 9.500.000đ');
    await sendMessage(senderId, null, 'https://i.postimg.cc/hPMwbd8x/2.png');
    // Sau 10s gửi thêm dòng ưu đãi slot
    setTimeout(() => {
      sendMessage(senderId, 'Mình xem thử 3 gói Cody đang ưu đãi nhen, hiện tại còn vài slot thôi ạ');
    }, 10000);
    // Không gọi GPT nữa sau khi đã gửi 3 package, chỉ gửi cứng
    return;
  }

  // Nếu đã đủ info, đã gửi ưu đãi, nhưng khách hỏi lại về giá/gói/ưu đãi thì nhắc lại 3 gói ưu đãi
  // Chỉ nhắc lại 3 gói ưu đãi nếu KHÁCH chưa hỏi trong vòng 3 phút gần nhất
  if (
    user.hasSentPackages &&
    /giá|gói|ưu đãi|package|bảng giá|bao nhiêu|khuyến mãi|khuyến mại|promotion|offer/i.test(lower)
  ) {
    const now = Date.now();
    if (!user.lastSentPackagesReminder || now - user.lastSentPackagesReminder > 3 * 60 * 1000) {
      await sendMessage(senderId, 'Dạ, Cody nhắc lại 3 gói ưu đãi của tháng bên em nhen ❤️');
      // Package 1
      await sendMessage(senderId, '🎁 **Package 1:** 2 máy quay + 2 máy chụp, giá 16.500.000đ');
      await sendMessage(senderId, null, 'https://i.postimg.cc/Gm4VhfkS/Peach-Modern-Wedding-Save-the-Date-Invitation-1.png');
      // Package 2
      await sendMessage(senderId, '🎁 **Package 2:** 1 máy quay + 2 máy chụp, giá 12.500.000đ');
      await sendMessage(senderId, null, 'https://i.postimg.cc/prJNtnMQ/1.png');
      // Package 3
      await sendMessage(senderId, '🎁 **Package 3:** 1 máy quay + 1 máy chụp, giá 9.500.000đ');
      await sendMessage(senderId, null, 'https://i.postimg.cc/hPMwbd8x/2.png');
      user.lastSentPackagesReminder = now;
      memory[senderId] = user; saveMemory();
    }
    return;
  }

  // --- Kết thúc block ưu đãi ---

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
    await sendMessage(senderId, `Đúng rồi nè, mình đặt sớm để giữ ngày, block team và block ưu đãi luôn á`);
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

  // 3. Sau khi gửi 3 gói package, KHÔNG gửi thêm dòng ưu đãi slot nữa (theo yêu cầu mới)

  // Opening messages
  // Đã loại bỏ các dòng chào/mở đầu cứng theo yêu cầu, không gửi openingFewShot nữa

  // Nếu đã gửi 3 package và đã gửi dòng ưu đãi slot, cho phép dùng lại GPT nếu không trùng rule cứng
  if (user.hasSentPackages) {
    // Check các rule cứng sau khi gửi package
    // Nếu trùng rule cứng thì vẫn ưu tiên trả lời rule cứng và return
    if (
      /giá|gói|ưu đãi|package|bảng giá|bao nhiêu|khuyến mãi|khuyến mại|promotion|offer/i.test(lower)
      || /sameday edit là gì|sde là gì/i.test(lower)
      || /(bên anh có nhận đi tỉnh|nhà em ở tỉnh|em ở tỉnh|đi tỉnh không)/i.test(lower)
      || /đặt trong tháng.*(mới có|mới được).*ưu đãi|ưu đãi.*trong tháng/i.test(lower)
      || /(phí đi lại|phí di chuyển|phí xe|phí khách sạn|phí phát sinh)/i.test(lower)
      || /(lễ nhà thờ|hôn phối).*phát sinh.*không|có phát sinh.*lễ nhà thờ|có phát sinh.*hôn phối/i.test(lower) && /trong ngày|trong ngày cưới|cùng ngày/i.test(lower)
      || /(lễ nhà thờ|hôn phối).*tách ngày|ngày khác|khác ngày/i.test(lower)
      || /để em bàn lại với chồng|em hỏi ý.*gia đình|em hỏi ý thêm gia đình/i.test(lower)
      || /cho em book|em muốn book|em muốn book gói|em muốn book package|em muốn đặt gói|em muốn đặt package|em muốn book gói package/i.test(lower)
      || /giá.*1 buổi|giá quay 1 buổi|giá chụp 1 buổi|giá 1 buổi chụp|giá 1 buổi quay|giá 1 buổi|giá quay chụp 1 buổi|giá 1 buổi chụp hình quay phim|giá 1 buổi quay phim chụp hình/i.test(lower)
    ) {
      return;
    }
    // Nếu không trùng rule cứng thì cho phép gọi lại GPT
  }
  // Nếu không khớp rule, gọi GPT-4.1 Turbo với prompt tự nhiên
  if (!user.gptHistory) user.gptHistory = [];
  let gptHistoryForCall = [...user.gptHistory, { role: 'user', content: messageText }];
  let gptReply = await callOpenAI(gptHistoryForCall, messageText);
  // Xử lý nếu GPT trả lời quá ngắn hoặc không tự nhiên
  if (gptReply && gptReply.length < 10) {
    gptReply = 'Cody cảm ơn bạn đã nhắn tin! Bạn có thể cho Cody biết thêm về ngày tổ chức, địa điểm hoặc mong muốn của mình không ạ?';
  }
  user.gptHistory.push({ role: 'user', content: messageText });
  // Tách câu trả lời thành nhiều đoạn nếu có xuống dòng, gửi từng đoạn như người thật
  const replyParts = gptReply.split(/\n+/).map(s => s.trim()).filter(Boolean);
  for (const part of replyParts) {
    user.gptHistory.push({ role: 'assistant', content: part });
    await sendMessage(senderId, part);
  }
  memory[senderId] = user; saveMemory();
  return;

  // Nếu không khớp logic nào, kiểm tra block reply 3 ngày hoặc 30 phút sau agent
  // (đoạn này không còn cần thiết vì đã return ở trên)
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
