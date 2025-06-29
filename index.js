require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Webhook verification
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// Handle messages
app.post("/webhook", async (req, res) => {
  const messaging = req.body.entry[0].messaging[0];
  const senderId = messaging.sender.id;
  const text = messaging.message?.text;
  if (!text) return res.sendStatus(200);

  // Prepare GPT prompt
  const prompt = [
    { role: "system", content: "Bạn là nhân viên tư vấn của Cody Studio – chuyên quay phóng sự cưới. Trả lời khách nhẹ nhàng, rõ ràng, dễ hiểu, xoay quanh báo giá, gói dịch vụ, flycam, Same Day Edit." },
    { role: "user", content: text }
  ];

  const gptRes = await axios.post("https://api.openai.com/v1/chat/completions", {
    model: "gpt-3.5-turbo",
    messages: prompt
  }, {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
  });

  const reply = gptRes.data.choices[0].message.content;

  await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
    recipient: { id: senderId },
    message: { text: reply }
  });

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot chạy tại http://localhost:${PORT}`));
