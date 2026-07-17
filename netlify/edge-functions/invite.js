// ═══════════════════════════════════════════════════════════════
//  R•Code — Edge Function لمعاينة الواتساب
//  كل دعوة تطلع بغلافها المخصّص (أو صورة الدعوة) بكرت واتساب
//
//  الأولوية:  غلاف المعاينة  ←  صورة الدعوة  ←  شعار الموقع
//
//  ملاحظة: نجيب البيانات باستعلام مباشر (guests + events) بدل
//  تعديل دالة pub_rsvp_get — أأمن، ما نخاطر بكسر الدعوات.
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://lutfjdsuinaqswvgkmet.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1dGZqZHN1aW5hcXN3dmdrbWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTYyMjQsImV4cCI6MjA5ODgzMjIyNH0.roY4YGSmYtsOC6TFtmgRZ9velYJzNQasIomITBC3v8g';

const H = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

export default async (request, context) => {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/(?:i\/)?([A-Za-z0-9-]{6,40})\/?$/);
  const code = m ? m[1] : null;

  const response = await context.next();

  if (!code || /\.(html?|png|jpe?g|svg|ico|css|js|txt|json|xml|webmanifest)$/i.test(code)) {
    return response;
  }
  const ctype = response.headers.get('content-type') || '';
  if (!ctype.includes('text/html')) return response;

  let html;
  try { html = await response.text(); }
  catch (e) { return response; }

  try {
    // 1) نجيب الضيفة → event_id
    const gRes = await fetch(
      `${SUPABASE_URL}/rest/v1/guests?qr_code=eq.${encodeURIComponent(code)}&select=event_id&limit=1`,
      { headers: H }
    );
    const guests = gRes.ok ? await gRes.json() : [];

    if (guests.length && guests[0].event_id) {
      // 2) نجيب المناسبة → الصور + الاسم
      const eRes = await fetch(
        `${SUPABASE_URL}/rest/v1/events?id=eq.${guests[0].event_id}&select=name,cover_image,preview_image&limit=1`,
        { headers: H }
      );
      const events = eRes.ok ? await eRes.json() : [];

      if (events.length) {
        const ev = events[0];
        const image = ev.preview_image || ev.cover_image;

        // نبدّل *الصورة فقط* بالغلاف — ونخلي العنوان والجملة زي ما هي بالصفحة
        // (العنوان: دعوة خاصة · الوصف: اضغطي لتأكيد حضورك وعرض باركود الدخول)
        if (image) {
          html = injectMeta(html, 'og:image', image, 'property');
          html = injectMeta(html, 'twitter:image', image, 'name');
        }
      }
    }
  } catch (e) {
    // أي خطأ → الصفحة الأصلية بالصورة الافتراضية (ما نكسر شي)
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html, { headers, status: response.status });
};

function injectMeta(html, key, value, attr) {
  const v = esc(value);
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`, 'i');
  if (re.test(html)) return html.replace(re, `$1${v}$2`);
  return html.replace(/<\/head>/i, `<meta ${attr}="${key}" content="${v}"></head>`);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const config = { path: '/*' };
