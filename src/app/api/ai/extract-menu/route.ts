import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Dosya bulunamadı" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const isTextFile = file.type === "text/plain" || file.name.endsWith(".txt");

    let message: Anthropic.Message;

    if (isTextFile) {
      // For text files, send content as plain text
      const textContent = new TextDecoder().decode(buffer);
      message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Bu belgeden menü isimlerini çıkar. Sadece yemek/menü isimlerini listele, her satıra bir tane. Başka açıklama yapma, sadece menü isimlerini yaz.

İşte belge içeriği:
${textContent}

Örnek çıktı formatı:
Mercimek Çorbası
Etli Kuru Fasulye
Pilav
Ayran`,
          },
        ],
      });
    } else {
      // For PDF files, use document type
      const base64 = Buffer.from(buffer).toString("base64");
      message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              {
                type: "text",
                text: `Bu belgeden menü isimlerini çıkar. Sadece yemek/menü isimlerini listele, her satıra bir tane. Başka açıklama yapma, sadece menü isimlerini yaz.

Örnek çıktı formatı:
Mercimek Çorbası
Etli Kuru Fasulye
Pilav
Ayran`,
              },
            ],
          },
        ],
      });
    }

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const menuItems = content.text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return NextResponse.json({ menuItems });
  } catch (error) {
    console.error("Extract menu error:", error);
    return NextResponse.json(
      { error: "Menü çıkarma işlemi başarısız oldu" },
      { status: 500 }
    );
  }
}
