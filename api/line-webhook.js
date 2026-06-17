import crypto from "crypto";

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

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);

  return lines
    .slice(1)
    .map((line) => {
      const cols = parseCSVLine(line);

      return {
        question: (cols[1] || "").trim(),
        answer: (cols[2] || "").trim(),
      };
    })
    .filter((item) => item.question && item.answer);
}

async function getFAQFromSheet() {
  const res = await fetch(process.env.SHEET_CSV_URL);
  const text = await res.text();
  return parseCSV(text);
}

function normalizeThai(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[?？!！.。,，:：;；"'“”‘’()（）\[\]{}]/g, "")
    .replace(/ครับ|ค่ะ|คะ|จ้า|จ๊ะ|หน่อย|หน่อยค่ะ|หน่อยครับ/g, "")
    .trim();
}

function scoreSimilarity(userText, question) {
  const user = normalizeThai(userText);
  const q = normalizeThai(question);

  if (!user || !q) return 0;
  if (user === q) return 100;
  if (user.includes(q) || q.includes(user)) return 90;

  let score = 0;

  for (const char of q) {
    if (user.includes(char)) {
      score++;
    }
  }

  return Math.round((score / q.length) * 100);
}

function findAnswer(userText, faqList) {
  let bestMatch = null;
  let bestScore = 0;

  for (const item of faqList) {
    const score = scoreSimilarity(userText, item.question);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestScore >= 45) {
    return bestMatch.answer;
  }

  return null;
}

async function askGemini(userText, faqList) {
  const faqText = faqList
    .map((item, index) => `${index + 1}. คำถาม: ${item.question}\nคำตอบ: ${item.answer}`)
    .join("\n\n");

  const prompt = `
คุณคือระบบเลือกคำตอบจาก FAQ

หน้าที่ของคุณ:
- อ่านคำถามลูกค้า
- เลือกคำตอบที่ใกล้เคียงที่สุดจาก FAQ
- ตอบเฉพาะ "คำตอบ" จาก FAQ เท่านั้น
- ห้ามแต่งข้อมูลใหม่
- ห้ามอธิบายเพิ่ม

ถ้าไม่มี FAQ ที่เกี่ยวข้อง ให้ตอบว่า:
ขออภัยค่ะ เรื่องนี้ยังไม่มีข้อมูลในระบบ เดี๋ยวทีมงานติดต่อกลับนะคะ

FAQ:
${faqText}

คำถามลูกค้า:
${userText}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.Gemini_API_Key}`;

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    const data = await geminiRes.json();

    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "ขออภัยค่ะ ระบบยังตอบไม่ได้ในตอนนี้"
    );
  } catch (error) {
    return "ขออภัยค่ะ ระบบยังตอบไม่ได้ในตอนนี้";
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const faqList = await getFAQFromSheet();

    return res.status(200).json({
      status: "ok",
      message: "LINE webhook is working",
      faqCount: faqList.length,
      sampleFAQ: faqList.slice(0, 5),
      env: {
        hasGemini: !!process.env.Gemini_API_Key,
        hasLineSecret: !!process.env.Channel_secret,
        hasLineToken: !!process.env.Line_Channel_access_token,
        hasSheet: !!process.env.SHEET_CSV_URL,
      },
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
