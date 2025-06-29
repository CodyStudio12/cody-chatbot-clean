require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PAGE_ID = "101994172873172"; // ID Fanpage Cody Studio

const memory = {}; // { senderId: [...chat history...] }
const userContext = {}; // { senderId: {date:..., location:..., hasSentPackages: true/false} }

app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  const messaging = req.body.entry?.[0]?.messaging?.[0];
  if (!messaging || !messaging.message || !messaging.message.text) return res.sendStatus(200);

  const senderId = messaging.sender.id;
  const userMessage = messaging.message.text;

  // Nếu admin đang nhắn thì bot im
  if (senderId === PAGE_ID) {
    console.log("🛑 Admin đang nhắn – bot không trả lời");
    return res.sendStatus(200);
  }

  // Khởi tạo nếu lần đầu
  if (!memory[senderId]) {
    memory[senderId] = [
      {
        role: "system",
        content: `Bạn là nhân viên tư vấn của Cody Studio – chuyên quay phóng sự cưới.
Hãy trả lời khách hàng bằng giọng nhẹ nhàng, gần gũi, chuyên nghiệp, rõ ràng, nhưng không máy móc.
Xưng hô linh hoạt theo cách khách nhắn ("anh", "chị", "bạn"...), nhận mình là Cody, luôn sử dụng những từ như ạ, nhen, nè, và khi hỏi hay tư vấn 1 câu ngắn sau đó mới hỏi tiếp, đã chào lần đầu rồi thì không chào nữa.
Luôn hỏi kỹ:
- Ngày cưới
- Địa điểm tổ chức
- Có lễ nhà thờ hoặc Hằng Thuận không
- Có quay sáng – chiều cùng ngày hay tách ngày?
Khi khách hỏi gói, sau khi biết ngày và địa điểm, hãy gửi 3 gói ưu đãi tháng này – mỗi gói là 1 tin nhắn riêng.
Nếu gặp câu hỏi không rõ thì nói: "Mình đợi Cody 1 xíu nhen".`
      }
    ];
    userContext[senderId] = { date: null, location: null, hasSentPackages: false };
  }

  memory[senderId].push({ role: "user", content: userMessage });

  if (memory[senderId].length > 20) {
    memory[senderId] = memory[senderId].slice(-20);
  }

  try {
    const gptRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        messages: memory[senderId]
      },
      {
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
      }
    );

    const reply = gptRes.data.choices[0].message.content;
    memory[senderId].push({ role: "assistant", content: reply });

    // Lưu ngữ cảnh
    const lower = userMessage.toLowerCase();
    if (!userContext[senderId].date && lower.match(/\d{1,2}[\/\-]\d{1,2}/)) {
      userContext[senderId].date = userMessage;
    }
    if (!userContext[senderId].location && lower.includes("quận") || lower.includes("tỉnh") || lower.includes("tp") || lower.includes("thành phố")) {
      userContext[senderId].location = userMessage;
    }

    // Gửi tin chính
    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: senderId },
      message: { text: reply }
    });

    // Nếu đã có ngày & địa điểm mà chưa gửi package thì gửi 3 gói
    if (
      userContext[senderId].date &&
      userContext[senderId].location &&
      !userContext[senderId].hasSentPackages
    ) {
      userContext[senderId].hasSentPackages = true;

      const packages = [
        {
          text: `💕 PACKAGE 1 – 2 máy quay phóng sự + 2 máy chụp hình
💸 Giá ưu đãi: 𝟭𝟲.𝟱𝟬𝟬.𝟬𝟬𝟬đ (Giá gốc 𝟭𝟵.𝟬𝟬𝟬.𝟬𝟬𝟬đ)

🌟 Ưu đãi đặc biệt khi book trong tháng dành cho 10 khách đầu tiên:
🎁 Tặng Photobook cao cấp (20x20cm – 30 trang)
🎁 Tặng Video Sameday Edit chiếu tiệc tối (SG)
🎁 Tặng 2 video Reel/TikTok (nếu cần)
🎁 1 bạn hỗ trợ riêng (online)
🎁 Tặng phí Lễ Nhà Thờ / Hằng Thuận cùng ngày
🎁 Tặng Flycam (Video có sẵn) – Thu âm – Phỏng vấn – Kịch bản – Chỉnh màu – Làm da
🎁 Tặng phí quay ngoại tỉnh (chưa gồm phí di chuyển)
🎁 Giảm 50% phí phát sinh khác ngày
🎁 Hỗ trợ lighting tại nhà cô dâu & nhà hàng
🎁 Giảm 10% khi book Váy cưới, Áo dài, Trang trí (Đối tác Cody Studio)
💍 Ekip chính chủ Cody Studio – Không thuê ngoài
🎬 Quay phim chất lượng 4K

🎞 Sản phẩm Bao gồm:
– 1 video Phóng Sự (7–15 phút)
– 1 video Truyền Thống (30–60 phút)
– 1 bộ hình Phóng Sự đã chỉnh sửa
– 1 bộ hình Truyền Thống đã chỉnh sửa
📸 Cody sẽ lọc và chỉnh sửa toàn bộ ảnh cho đẹp nhất`,
          image: "https://scontent.fsgn2-5.fna.fbcdn.net/v/t1.15752-9/487224212_912736807480604_5207587766901426657_n.png?stp=dst-png_p720x720&_nc_cat=104&ccb=1-7&_nc_sid=0024fc&_nc_ohc=JAY-ukrNG6oQ7kNvwFb8W69&_nc_oc=Adm85XEPamIeacoMFaDSSz1QRuWKD5RCvDI9_JxDcT-A0ZdUFNUGFU4lHOlQqHWQqkuOtgjBZ_D-MWfN19mPPZHK&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.fsgn2-5.fna&oh=03_Q7cD2gG6HDZS7Q07XZwWszgAkJnQ4MKcmjXpb7ZlN2xMcgsXVw&oe=6889006D",
        },
        {
          text: `💕 PACKAGE 1 – 2 máy quay phóng sự + 2 máy chụp hình
💸 Giá ưu đãi: 𝟭𝟲.𝟱𝟬𝟬.𝟬𝟬𝟬đ (Giá gốc 𝟭𝟵.𝟬𝟬𝟬.𝟬𝟬𝟬đ)

🌟 Ưu đãi đặc biệt khi book trong tháng dành cho 10 khách đầu tiên:
🎁 Tặng Photobook cao cấp (20x20cm – 30 trang)
🎁 Tặng Video Sameday Edit chiếu tiệc tối (SG)
🎁 Tặng 2 video Reel/TikTok (nếu cần)
🎁 1 bạn hỗ trợ riêng (online)
🎁 Tặng phí Lễ Nhà Thờ / Hằng Thuận cùng ngày
🎁 Tặng Flycam (Video có sẵn) – Thu âm – Phỏng vấn – Kịch bản – Chỉnh màu – Làm da
🎁 Tặng phí quay ngoại tỉnh (chưa gồm phí di chuyển)
🎁 Giảm 50% phí phát sinh khác ngày
🎁 Hỗ trợ lighting tại nhà cô dâu & nhà hàng
🎁 Giảm 10% khi book Váy cưới, Áo dài, Trang trí (Đối tác Cody Studio)
💍 Ekip chính chủ Cody Studio – Không thuê ngoài
🎬 Quay phim chất lượng 4K

🎞 Sản phẩm Bao gồm:
– 1 video Phóng Sự (7–15 phút)
– 1 video Truyền Thống (30–60 phút)
– 1 bộ hình Phóng Sự đã chỉnh sửa
– 1 bộ hình Truyền Thống đã chỉnh sửa
📸 Cody sẽ lọc và chỉnh sửa toàn bộ ảnh cho đẹp nhất`,
          image: "https://scontent.fsgn2-6.fna.fbcdn.net/v/t1.15752-9/456707291_1045083470341631_8812677045981160249_n.png?stp=dst-png_p720x720&_nc_cat=111&ccb=1-7&_nc_sid=0024fc&_nc_ohc=cUWcX1KAMSAQ7kNvwGVY7vt&_nc_oc=Adn0UdWPXccSpuWz2kBNhGHfcexe0ipOSphlbUbt6xHE47lS4oge4MrsdkbMZmAf7C8LKsEWAhcJZSxMiou7a_EY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.fsgn2-6.fna&oh=03_Q7cD2gE_J4xAoYx8pqvTp1qvFvdgAxDcH06BYdEsSibMUcDIWQ&oe=6888EF1D",
        },
        {
          text: `💕 PACKAGE 3 – 1 máy quay phóng sự + 1 máy chụp hình phóng sự (hỗ trợ chụp thêm hình Truyền Thống)
💸 Giá ưu đãi: 𝟵.𝟱𝟬𝟬.𝟬𝟬𝟬đ (Giá gốc 𝟭𝟭.𝟱𝟬𝟬.𝟬𝟬𝟬đ)
🎯 Chỉ áp dụng cho 10 khách book trong tháng

🌟 Ưu đãi đặc biệt khi book sớm:
🎁 Tặng Hình Gia Đình cao cấp size 40x60 có viền
🎁 Tặng Video Sameday Edit chiếu tiệc tối
🎁 Tặng 2 video Reel/TikTok (nếu cần)
🎁 1 bạn hỗ trợ riêng (online)
🎁 Tặng phí Lễ Nhà Thờ / Hằng Thuận cùng ngày
🎁 Tặng Flycam (Video có sẵn) – Thu âm – Phỏng vấn – Kịch bản – Chỉnh màu – Làm da
🎁 Tặng phí quay ngoại tỉnh (chưa gồm phí di chuyển)
🎁 Giảm 50% phí phát sinh khác ngày
🎁 Hỗ trợ lighting tại nhà cô dâu & nhà hàng
🎁 Giảm 10% khi book Váy cưới, Áo dài, Trang trí (Đối tác Cody Studio)

💍 Ekip chính chủ Cody Studio – Không thuê ngoài
🎬 Quay phim chất lượng 4K

🎞 Bao gồm:
– 1 video Phóng Sự (7–15 phút)
– 1 bộ hình Phóng Sự pha Truyền Thống đã chỉnh sửa
📸 Cody sẽ lọc và chỉnh sửa toàn bộ ảnh cho đẹp nhất`,
          image: "https://scontent.fsgn2-6.fna.fbcdn.net/v/t1.15752-9/457348421_3925309787794850_3749211656319403645_n.png?stp=dst-png_p720x720&_nc_cat=110&ccb=1-7&_nc_sid=0024fc&_nc_ohc=x9s4iBMOf9YQ7kNvwEwQ6rQ&_nc_oc=AdllDA7X37eWu3JBiJ9fUhHndTCufstF-3g929OUErpk8o9xoyMWBM2amkRyIMdGkYPBxLx-XNwXSiEQh0tRQrqa&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.fsgn2-6.fna&oh=03_Q7cD2gH5Bi5wgLW9XcUyFu-o9foiGWZUZduY4zqVZHtRjBGy6g&oe=6888F090",
        },
      ];

      for (const pkg of packages) {
        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
          recipient: { id: senderId },
          message: {
            attachment: {
              type: "image",
              payload: {
                url: pkg.image,
                is_reusable: true
              }
            }
          }
        });

        await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
          recipient: { id: senderId },
          message: { text: pkg.text }
        });
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ GPT lỗi:", err.message);

    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: senderId },
      message: { text: "Mình đợi Cody 1 xíu nhen" }
    });

    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot chạy tại http://localhost:${PORT}`);
});
