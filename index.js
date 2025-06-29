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
  const user = memory[senderId] || { date: null, location: null, hasSentPackages: false };
  const lower = messageText.toLowerCase();

  if (!user.date && /\d{1,2}[/\-]\d{1,2}([/\-]\d{2,4})?/.test(lower)) user.date = messageText;
  if (!user.location && /(sài gòn|sg|hcm|đà nẵng|hà nội|nha trang|vũng tàu|biên hòa|cần thơ)/i.test(lower)) user.location = messageText;

  memory[senderId] = user;

  if (!user.date) return sendMessage(senderId, 'Mình note lại nha. Cho mình xin **ngày tổ chức cưới** của mình trước nha');
  if (!user.location) return sendMessage(senderId, 'Cảm ơn mình nhiều nhen. Cho mình xin thêm **địa điểm tổ chức** luôn nha');

  if (!user.hasSentPackages) {
    user.hasSentPackages = true;
    await sendMessage(senderId, 'Dạ, dưới đây là 3 gói ưu đãi của tháng bên em nhen ❤️');

    await sendMessage(senderId, `💕 PACKAGE 1 – 2 máy quay phóng sự + 2 máy chụp hình
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
📸 Cody sẽ lọc và chỉnh sửa toàn bộ ảnh cho đẹp nhất`, 'https://scontent.fsgn2-5.fna.fbcdn.net/v/t1.15752-9/487224212_912736807480604_5207587766901426657_n.png?stp=dst-png_p720x720&_nc_cat=104&ccb=1-7&_nc_sid=0024fc&_nc_ohc=JAY-ukrNG6oQ7kNvwFb8W69&_nc_oc=Adm85XEPamIeacoMFaDSSz1QRuWKD5RCvDI9_JxDcT-A0ZdUFNUGFU4lHOlQqHWQqkuOtgjBZ_D-MWfN19mPPZHK&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.fsgn2-5.fna&oh=03_Q7cD2gG6HDZS7Q07XZwWszgAkJnQ4MKcmjXpb7ZlN2xMcgsXVw&oe=6889006D');

    await sendMessage(senderId, `💕 PACKAGE 2 – 1 máy quay phóng sự + 2 máy chụp hình
💸 Giá ưu đãi: 𝟭𝟮.𝟱𝟬𝟬.𝟬𝟬𝟬đ (Giá gốc 𝟭𝟰.𝟱𝟬𝟬.𝟬𝟬𝟬đ)
🎯 Chỉ áp dụng cho 10 khách book trong tháng

🌟 Ưu đãi đặc biệt khi book sớm:
🎁 Tặng Photobook cao cấp (20x20cm – 30 trang)
🎁 Tặng Video Sameday Edit chiếu tiệc tối
🎁 Tặng 2 video Reel/TikTok (nếu cần)
🎁 1 bạn hỗ trợ riêng (online)
🎁 Tặng phí Lễ Nhà Thờ / Hằng Thuận cùng ngày
🎁 Tặng Flycam (Video có sẵn) – Thu âm – Phỏng vấn – Kịch bản – Chỉnh màu – Làm da
🎁 Tặng phí quay ngoại tỉnh (chưa gồm phí di chuyển)
🎁 Tặng thêm quà trị giá 5.000.000đ khi book sớm
🎁 Giảm 50% phí phát sinh khác ngày
🎁 Hỗ trợ lighting tại nhà cô dâu & nhà hàng
🎁 Giảm 10% khi book Váy cưới, Áo dài, Trang trí (Đối tác Cody Studio)
💍 Ekip chính chủ Cody Studio – Không thuê ngoài
🎬 Quay phim chất lượng 4K

🎞 Bao gồm:
– 1 video Phóng Sự (7–15 phút)
– 1 bộ hình Phóng Sự đã chỉnh sửa
– 1 bộ hình Truyền Thống đã chỉnh sửa
📸 Cody sẽ lọc và chỉnh sửa toàn bộ ảnh cho đẹp nhất`, 'https://scontent.fsgn2-6.fna.fbcdn.net/v/t1.15752-9/456707291_1045083470341631_8812677045981160249_n.png?stp=dst-png_p720x720&_nc_cat=111&ccb=1-7&_nc_sid=0024fc&_nc_ohc=cUWcX1KAMSAQ7kNvwGVY7vt&_nc_oc=Adn0UdWPXccSpuWz2kBNhGHfcexe0ipOSphlbUbt6xHE47lS4oge4MrsdkbMZmAf7C8LKsEWAhcJZSxMiou7a_EY&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.fsgn2-6.fna&oh=03_Q7cD2gE_J4xAoYx8pqvTp1qvFvdgAxDcH06BYdEsSibMUcDIWQ&oe=6888EF1D');

    await sendMessage(senderId, `💕 PACKAGE 3 – 1 máy quay phóng sự + 1 máy chụp hình phóng sự (hỗ trợ chụp thêm hình Truyền Thống)
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
📸 Cody sẽ lọc và chỉnh sửa toàn bộ ảnh cho đẹp nhất`, 'https://scontent.fsgn2-6.fna.fbcdn.net/v/t1.15752-9/457348421_3925309787794850_3749211656319403645_n.png?stp=dst-png_p720x720&_nc_cat=110&ccb=1-7&_nc_sid=0024fc&_nc_ohc=x9s4iBMOf9YQ7kNvwEwQ6rQ&_nc_oc=AdllDA7X37eWu3JBiJ9fUhHndTCufstF-3g929OUErpk8o9xoyMWBM2amkRyIMdGkYPBxLx-XNwXSiEQh0tRQrqa&_nc_ad=z-m&_nc_cid=0&_nc_zt=23&_nc_ht=scontent.fsgn2-6.fna&oh=03_Q7cD2gH5Bi5wgLW9XcUyFu-o9foiGWZUZduY4zqVZHtRjBGy6g&oe=6888F090');
  }
}

// === NHẬN WEBHOOK TỪ FACEBOOK ===
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'page') {
    for (const entry of body.entry) {
      for (const event of entry.messaging) {
        const senderId = event.sender.id;

        // Nếu là tin nhắn do page gửi (admin), thì lưu vào danh sách đã trả lời
        if (event.message?.is_echo) {
          recentReplies[senderId] = 'admin';
          continue;
        }

        // Nếu đã có admin trả lời thì bot không trả lời nữa
        if (recentReplies[senderId] === 'admin') continue;

        // Nếu đã trả lời gần đây trong 10 phút thì bỏ qua
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
