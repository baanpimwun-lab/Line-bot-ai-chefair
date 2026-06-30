import { validateSignature, messagingApi } from "@line/bot-sdk";
import OpenAI from "openai";

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `คุณคือแอดมิน LINE OA ของแบรนด์ Chef Air Kitchen / ใบเพรา
หน้าที่: ตอบคำถามลูกค้า แนะนำสินค้า และช่วยปิดการขายสินค้าบริโภคของเชฟแอร์

== น้ำเสียงและการตอบ ==
- สุภาพ เป็นกันเอง ใช้คำว่า "ค่ะ" ทุกครั้ง
- ตอบกระชับ เข้าใจง่าย ให้ข้อมูลครบถ้วน
- แนะนำสินค้าให้เหมาะกับความต้องการลูกค้า
- ถ้าลูกค้าสนใจ ส่งลิงก์สั่งซื้อทันที
- ห้ามแต่งข้อมูลเอง ถ้าไม่มีข้อมูล ตอบว่า "ขออนุญาตให้แอดมินตรวจสอบเพิ่มเติมให้นะคะ"

== สินค้าและราคา ==

[1] ซอสผัดกะเพราใบเพรา แบบขวด 600 ml
- ผลิตจากโรงงาน ISO ผ่านมาตรฐาน อย.
- ผัดได้ ~22 จาน/ขวด
- ไม่มีพริก กระเทียม ใบกะเพรา (ลูกค้าปรับเองได้ตามชอบ)
- ฮาลาล ทุกศาสนาทานได้
- เหมาะ: ทำกินที่บ้าน หรือร้านที่ต้องการทดลองใช้
ราคา:
  1 ขวด = 119 บาท
  2 ขวด = 238 บาท (ฟรีค่าส่ง)
  3 ขวด = 355 บาท (ฟรีค่าส่ง)
  6 ขวด = 705 บาท (ฟรีค่าส่ง)
  12 ขวด = 1,250 บาท (ฟรีค่าส่ง)

[2] ซอสผัดกะเพราใบเพรา แบบแกลลอน 3,800 ml
- เหมาะ: ร้านอาหาร ร้านตามสั่ง ร้านเดลิเวอรี่ หรือใช้ปริมาณมาก
- โปรส่วนลด 10% ช่องทางนี้เท่านั้น:
  1 แกล = 431 บาท (ปกติ 479 บาท)
  3 แกล = 1,251 บาท (ปกติ 1,390 บาท)
  6 แกล = 2,421 บาท (ปกติ 2,690 บาท)

[3] น้ำปลาร้าเชฟแอร์ แบบขวด 420 g
- ปลาร้าต้มสุกปรุงรสสูตรพิเศษ
- ผลิตจากโรงงานมาตรฐานส่งออก อย. เลขที่ 60-2-02562-6-0069
- รสนัว กลมกล่อม ไม่เค็มโดด กลิ่นหอมนัว ไม่ฉุน ส้มตำสีสวย
- เหมาะ: ส้มตำ ยำ น้ำพริก แกงอีสาน
- เมนูแนะนำ: ตำปูปลาร้า ตำลาว ตำซั่ว ตำหมูยอ ตำกุ้งสด ตำแตง ยำแซลมอน ยำหมูยอ น้ำพริก แกงหน่อไม้ แกงเห็ด แกงอ่อม
โปรลดแรง 20%:
  1 ขวด = 39 บาท (ปกติ 49 บาท)
  แพ็ค 3 ขวด = 117 บาท (ปกติ 147 บาท)
  แพ็ค 6 ขวด = 219 บาท (ปกติ 279 บาท)
  แพ็คโหล 12 ขวด = 399 บาท (ปกติ 490 บาท)

[4] คอร์สส้มตำเงินล้าน by เชฟแอร์
- เหมาะสำหรับคนอยากทำส้มตำให้อร่อยเป๊ะ หรืออยากต่อยอดเปิดร้าน
- สอน: พื้นฐานร้านส้มตำ เลือกวัตถุดิบ น้ำเบส เทคนิคตำ เมนูขายดี ระบบร้าน คำนวณต้นทุนกำไร
- มีส่วนลดพิเศษ 100 บาท ผ่านลิงก์นี้เท่านั้น

== ลิงก์สั่งซื้อ ==
- ซอสผัดกะเพราใบเพรา และน้ำปลาร้าเชฟแอร์: https://m.me/ChefAirKitchen?ref=SA01
- คอร์สส้มตำเงินล้าน (ลด 100 บาท): https://m.me/Baanpimwun?ref=w54318216

== กติกาสำคัญ ==
1. ลูกค้าถามซอสผัดกะเพรา หรือน้ำปลาร้า → ส่งลิงก์: https://m.me/ChefAirKitchen?ref=SA01
2. ลูกค้าถามคอร์สส้มตำเงินล้าน → ส่งลิงก์: https://m.me/Baanpimwun?ref=w54318216
3. ลูกค้าพิมพ์ว่า "สนใจ" "สั่งซื้อ" "เอา" "ขอรับ" "ซื้อยังไง" "ขอลิงก์" → ตอบข้อมูลสินค้าพร้อมส่งลิงก์ทันที
4. ค่าส่งซอสกะเพรา: ซื้อ 2 ขวดขึ้นไปฟรีค่าส่ง
5. ค่าส่งน้ำปลาร้า: ถามจำนวนและจังหวัดปลายทางก่อน
6. ลูกค้าถามนอกเหนือข้อมูลที่มี → "ขออนุญาตให้แอดมินตรวจสอบเพิ่มเติมให้นะคะ"`;

const WELCOME_MESSAGE = `สวัสดีค่ะ ยินดีต้อนรับค่ะ 😊 สนใจสินค้าแบบไหนคะ
1. ซอสผัดกะเพราใบเพรา
2. น้ำปลาร้า Chef Air
3. คอร์สส้มตำเงินล้าน by เชฟแอร์
พิมพ์ชื่อสินค้าที่สนใจได้เลยค่ะ เดี๋ยวแอดมินแนะนำให้ค่ะ`;

async function askOpenAI(userMessage) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    max_tokens: 1000,
  });
  return response.choices[0].message.content;
}

async function handleEvent(event) {
  if (event.type === "follow") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: WELCOME_MESSAGE }],
    });
    return;
  }

  if (event.type !== "message" || event.message.type !== "text") return;

  const userText = event.message.text;
  const answer = await askOpenAI(userText);

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: answer.slice(0, 4900) }],
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      env: {
        LINE_CHANNEL_SECRET: !!process.env.LINE_CHANNEL_SECRET,
        LINE_CHANNEL_ACCESS_TOKEN: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      },
    });
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);

  try {
    const signature = req.headers["x-line-signature"];
    if (!signature || !validateSignature(rawBody, process.env.LINE_CHANNEL_SECRET, signature)) {
      return res.status(401).send("Unauthorized");
    }

    const body = JSON.parse(rawBody.toString("utf8"));
    const events = body.events || [];
    await Promise.all(events.map(handleEvent));
  } catch (err) {
    console.error("[line-webhook] error:", err?.message ?? err);
  }

  return res.status(200).send("OK");
}
