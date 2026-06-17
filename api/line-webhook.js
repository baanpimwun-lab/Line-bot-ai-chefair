import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.Gemini_API_Key,
});

function verifyLineSignature(body, signature) {
  const hash = crypto
    .createHmac("sha256", process.env.Channel_secret)
    .update(body)
    .digest("base64");

  return hash === signature;
}

async function replyLine(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.Line_Channel_access_token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

function parseCSV(text) {
  const lines = text.trim().split("\n");

  return lines.slice(1).map((line) => {
    const cols = line.split(",");

    return {
      question: (cols[1] || "").replaceAll('"', "").trim(),
      answer: (cols.slice(2).join(",") || "").replaceAll('"', "").trim(),
    };
  }).filter(item => item.question && item.answer);
}

async function getFAQFromSheet() {
  const res = await fetch(process.env.SHEET_CSV_URL);
  const text = await res.text();
  return parseCSV(text);
}

function findAnswer(userText, faqList) {
  const text = userText.toLowerCase().trim();

  for (const item of faqList) {
    const q = item.question.toLowerCase().trim();

    if (text.includes(q) || q.includes(text)) {
      return item.answer;
    }
  }

  return null;
}

async function askGemini(userText, faqList) {
  const faqText = faqList
    .map((item) => `คำถาม: ${item.question}\nคำตอบ: ${item.answer}`)
    .join("\n\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
คุณคือแอดมิน LINE OA
ตอบภาษาไทย สุภาพ กระชับ
ให้ตอบจากข้อมูล FAQ เท่านั้น
ห้ามแต่งข้อมูลเอง

ถ้าไม่มีข้อมูล ให้ตอบว่า:
"ขออภัยค่ะ เรื่องนี้ยังไม่มีข้อมูลในระบบ เดี๋ยวทีมงานติดต่อกลับนะคะ"

ข้อมูล FAQ:
${faqText}

ลูกค้าถาม:
${userText}
`,
  });

  return response.text || "ขออภัยค่ะ ระบบยังตอบไม่ได้ในตอนนี้";
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      status: "ok",
      message: "LINE webhook is working",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const rawBody = Buffer.concat(chunks).toString("utf8");
  const signature = req.headers["x-line-signature"];

  if (!verifyLineSignature(rawBody, signature)) {
    return res.status(401).send("Invalid signature");
  }

  const body = JSON.parse(rawBody);
  const faqList = await getFAQFromSheet();

  for (const event of body.events || []) {
    if (event.type !== "message") continue;
    if (event.message.type !== "text") continue;

    const userText = event.message.text;

    let answer = findAnswer(userText, faqList);

    if (!answer) {
      answer = await askGemini(userText, faqList);
    }

    await replyLine(event.replyToken, answer.slice(0, 4900));
  }

  return res.status(200).send("OK");
}
