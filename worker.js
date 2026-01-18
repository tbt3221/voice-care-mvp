export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // =========================
    // 音声取得（GET）
    // =========================
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

    // =========================
    // TTS生成（POST）
    // =========================
    if (request.method === "POST") {
      const body = await request.json();
      const text = body.text;

      if (!text) {
        return new Response("text missing", { status: 400 });
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
        return new Response("TTS failed", { status: 500 });
      }

      const audioBuffer = await openaiRes.arrayBuffer();
      const fileName = `audio/${crypto.randomUUID()}.mp3`;

      await env.VOICE_BUCKET.put(fileName, audioBuffer, {
        httpMetadata: { contentType: "audio/mpeg" }
      });

     return Response.json({
  audio_url: `${new URL(request.url).origin}/${fileName}`
});

    }

    return new Response("Not Found", { status: 404 });
  }
};
