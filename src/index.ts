export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    // ===== 音声配信（CDNキャッシュ対象）=====
    if (url.pathname.startsWith("/audio/")) {
      const key = url.pathname.replace("/audio/", "")
      const cacheKey = new Request(request.url, request)
      const cache = caches.default

      // ① キャッシュ確認
      let response = await cache.match(cacheKey)
      if (response) {
        return response
      }

      // ② R2から取得
      if (!object) {
        return new Response("Not Found", { status: 404 })
      }

      response = new Response(object.body, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      })

      // ③ CDNに保存
      ctx.waitUntil(cache.put(cacheKey, response.clone()))
      return response
    }
  // =====================
  // HTTPリクエスト（TTS & 配信）
  // =====================
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

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
      return new Response(err, { status: 500 });
    }

    const audioBuffer = await openaiRes.arrayBuffer();
    const id = crypto.randomUUID();
    // 保存
    const filename = `audio/${id}.mp3`
    // 配信
    const object = await env.VOICE_BUCKET.get(`audio/${key}.mp3`)
    await env.VOICE_BUCKET.put(filename, audioBuffer, {
      httpMetadata: { contentType: "audio/mpeg" }
    });
    const origin = new URL(request.url).origin
    return new Response(
      JSON.stringify({
        audio_url: `${origin}/audio/${id}`
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  },

  // =====================
  // R2 自動削除（Cron）
  // =====================
  async scheduled(event, env, ctx) {
    const MAX_AGE_DAYS = 7;
    const now = Date.now();
    const expireMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    let cursor;

    do {
      const list = await env.VOICE_BUCKET.list({
        prefix: "audio/",
        cursor
      });

      for (const obj of list.objects) {
        const uploaded = new Date(obj.uploaded).getTime();
        if (now - uploaded > expireMs) {
          await env.VOICE_BUCKET.delete(obj.key);
        }
      }

      cursor = list.cursor;
    } while (cursor);
  }
};
