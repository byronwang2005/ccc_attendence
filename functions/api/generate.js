import qr from 'qr-image';

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const formData = await request.json();
    const { url, timestamp } = formData;

    if (!url) {
      return new Response(JSON.stringify({ error: '缺少课程链接' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!timestamp) {
      return new Response(JSON.stringify({ error: '缺少时间参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const extractScheduleId = (inputUrl) => {
      const m1 = inputUrl.match(/[?&]id=([^&#]+)/);
      const m2 = inputUrl.match(/[?&]scheduleId=([^&#]+)/);
      return m1 ? m1[1] : (m2 ? m2[1] : null);
    };

    const sid = extractScheduleId(url);
    if (!sid) {
      return new Response(JSON.stringify({ error: '链接无效：未找到课程ID（id 或 scheduleId）' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const attendanceUrl = `https://ccc.nottingham.edu.cn/study/attendance?scheduleId=${sid}&time=${timestamp}`;

    // Generate QR Code as PNG
    const qrBuffer = qr.imageSync(attendanceUrl, { type: 'png', margin: 2, size: 10 });

    return new Response(qrBuffer, {
      headers: { 
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="qrcode.png"'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: '服务异常，请稍后重试' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
