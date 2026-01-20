export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    // =====================
    // 音声配信（GET /audio/xxx.mp3）
    // =====================
    if (request.method === "GET" && url.pathname.startsWith("/audio/")) {
      const key = url.pathname.slice(1); // audio/xxx.mp3

      const object = await env.VOICE_BUCKET.get(key);
      if (!object) {
        return new Response("Not Found", { status: 404 });
      }

      return new Response(object.body, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000"
        }
      });
    }

    // =====================
    // TTS生成（POST）
    // =====================
    if (request.method === "POST") {
      const { text } = await request.json();

      if (!text) {
        return new Response(
          JSON.stringify({ error: "text is required" }),
          { status: 400 }
        );
      }

      const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice: "alloy",
          input: text
        })
      });

      if (!openaiRes.ok) {
        const err = await openaiRes.text();
        console.error("OpenAI error:", err);
        return new Response("TTS failed", { status: 500 });
      }

      const audioBuffer = await openaiRes.arrayBuffer();
      const id = crypto.randomUUID();
      const filename = `audio/${id}.mp3`;

      await env.VOICE_BUCKET.put(filename, audioBuffer, {
        httpMetadata: { contentType: "audio/mpeg" }
      });

      return new Response(
        JSON.stringify({
          audio_url: `${url.origin}/${filename}`
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  }
};
