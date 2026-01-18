export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const text = body.text;

    if (!text || text.trim().length === 0) {
      return new Response("text missing", { status: 400 });
    }

    // OpenAI TTS
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

    const audioArrayBuffer = await openaiRes.arrayBuffer();
    const audioUint8 = new Uint8Array(audioArrayBuffer);

    const fileName = `voice/${crypto.randomUUID()}.mp3`;

    await env.VOICE_BUCKET.put(fileName, audioUint8, {
      httpMetadata: {
        contentType: "audio/mpeg"
      }
    });

    const publicUrl = `https://pub-81d41d93ffbe426588a79231df17a999.r2.dev/${fileName}`;

    return Response.json({
      audio_url: publicUrl
    });
  }
};
