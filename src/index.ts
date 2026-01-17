export default {
  async fetch(request: Request, env: any): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // バイナリを受信
    const audioBuffer = await request.arrayBuffer();

    if (audioBuffer.byteLength === 0) {
      return new Response(
        JSON.stringify({ error: "empty audio" }),
        { status: 400 }
      );
    }

    // ファイル名生成
    const id = crypto.randomUUID();
    const filename = `tts/${id}.mp3`;

    // R2 に保存
    await env.VOICE_BUCKET.put(filename, audioBuffer, {
      httpMetadata: {
        contentType: "audio/mpeg",
      },
    });

    // 公開URL（R2 Public URL）
    const publicUrl = `https://<YOUR_R2_PUBLIC_DOMAIN>/${filename}`;

    return new Response(
      JSON.stringify({
        audio_url: publicUrl,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  },
};
