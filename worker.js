export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await request.json();
    const audioBase64 = body.audio_base64;

    if (!audioBase64) {
      return new Response("audio missing", { status: 400 });
    }

    const audioBuffer = Uint8Array.from(
      atob(audioBase64),
      c => c.charCodeAt(0)
    );

    const fileName = `voice/${crypto.randomUUID()}.mp3`;

    await env.VOICE_BUCKET.put(fileName, audioBuffer, {
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
