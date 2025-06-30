diff --git a/index.js b/index.js
index 13ece7ae36d8421c0b3c86ce36b1af7e99582421..29b16b83bb66a66cffdaf921c6e8b67fad153780 100644
--- a/index.js
+++ b/index.js
@@ -1,55 +1,64 @@
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
-  for (let msg of messages) {
+  for (const msg of messages) {
     const payload = {
       messaging_type: 'RESPONSE',
       recipient: { id: recipientId },
       message: imageUrl
-        ? { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } }
-        : { text: msg },
+        ? {
+            attachment: {
+              type: 'image',
+              payload: { url: imageUrl, is_reusable: true },
+            },
+            metadata: 'from_bot',
+          }
+        : { text: msg, metadata: 'from_bot' },
     };
-    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, payload);
+    await axios.post(
+      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
+      payload
+    );
   }
 }
 
 // === PHÂN TÍCH NỘI DUNG VÀ TRẢ LỜI ===
 async function handleMessage(senderId, messageText) {
   const user = memory[senderId] || { date: null, location: null, type: null, hasSentPackages: false, sessionStarted: false };
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
 
     await sendMessage(senderId, "Hello Dâu nè ❤️ Cody cảm ơn vì đã nhắn tin ạ~");
     await sendMessage(senderId, "Mình đã có **ngày tổ chức** chưa nhen?");
     await sendMessage(senderId, "Và cho Cody xin luôn **địa điểm tổ chức** nha (SG hay ở tỉnh nè...)");
     await sendMessage(senderId, "Lễ cưới của mình là sáng lễ chiều tiệc hay tiệc trưa ha.");
     return;
   }
diff --git a/index.js b/index.js
index 13ece7ae36d8421c0b3c86ce36b1af7e99582421..29b16b83bb66a66cffdaf921c6e8b67fad153780 100644
--- a/index.js
+++ b/index.js
@@ -61,78 +70,72 @@ async function handleMessage(senderId, messageText) {
 
   memory[senderId] = user;
 
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
 
     await sendMessage(senderId, 'Dạ, dưới đây là 3 gói ưu đãi của tháng bên em nhen ❤️');
     await sendMessage(senderId, '🎁 **Package 1:** 2 máy quay + 2 máy chụp, giá 16.500.000đ\n👉 https://www.facebook.com/photo1');
     await sendMessage(senderId, '🎁 **Package 2:** 1 máy quay + 2 máy chụp, giá 12.500.000đ\n👉 https://www.facebook.com/photo2');
     await sendMessage(senderId, '🎁 **Package 3:** 1 máy quay + 1 máy chụp, giá 9.500.000đ\n👉 https://www.facebook.com/photo3');
   }
 }
-// Update sendMessage để đính kèm metadata "from_bot"
-async function sendMessage(senderId, messageText) {
-  const body = {
-    recipient: { id: senderId },
-    message: {
-      text: messageText,
-      metadata: "from_bot" // 🏷 Flag để phân biệt tin nhắn của bot
-    }
-  };
-
-  await axios.post(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, body);
-}
 
 // === NHẬN WEBHOOK TỪ FACEBOOK ===
 app.post('/webhook', async (req, res) => {
   const body = req.body;
   if (body.object === 'page') {
     for (const entry of body.entry) {
       for (const event of entry.messaging) {
-        const isFromBot = event.message?.metadata === "from_bot";
-if (event.message && !event.message.is_echo && !isFromBot) {
+        const senderId = event.sender.id;
+        const isFromBot = event.message?.metadata === 'from_bot';
+
+        // Tin nhắn do page gửi nhưng không phải bot
+        if (event.message?.is_echo && !isFromBot) {
+          recentReplies[senderId] = 'admin';
+          continue;
         }
 
         if (recentReplies[senderId] === 'admin') continue;
 
-        if (recentReplies[senderId] && Date.now() - recentReplies[senderId] < 10 * 60 * 1000) continue;
+        if (recentReplies[senderId] && Date.now() - recentReplies[senderId] < 10 * 60 * 1000)
+          continue;
 
-        if (event.message && event.message.text) {
+        if (event.message && event.message.text && !isFromBot) {
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
 
