// ═══════════════════════════════════════════════════════════════
//  R•Code — Edge Function لمعاينة الواتساب — النسخة 3
//  كل دعوة تطلع بغلافها المخصّص (أو صورة الدعوة) بكرت واتساب
//
//  الأولوية:  غلاف المعاينة  ←  صورة الدعوة  ←  شعار الموقع
//
//  الجديد في النسخة 2:
//  • صفحة تشخيص ذاتي: rqr0.com/الكود?debug=og
//    تعرض بالعربي وين وصلت الدالة ووش لقت — بدون أسرار
//  • حذف content-encoding مع content-length (تحصين)
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://lutfjdsuinaqswvgkmet.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1dGZqZHN1aW5hcXN3dmdrbWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTYyMjQsImV4cCI6MjA5ODgzMjIyNH0.roY4YGSmYtsOC6TFtmgRZ9velYJzNQasIomITBC3v8g';

const H = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
};

// يجيب صورة المعاينة لكود ضيفة — ويسجّل كل خطوة في steps
async function lookupImage(code, steps) {
  // 1) الضيفة → event_id
  const gRes = await fetch(
    `${SUPABASE_URL}/rest/v1/guests?qr_code=eq.${encodeURIComponent(code)}&select=event_id&limit=1`,
    { headers: H }
  );
  steps.push(`استعلام الضيفة: HTTP ${gRes.status}`);
  if (!gRes.ok) {
    steps.push('❌ القاعدة رفضت استعلام الضيفة');
    try {
      const body = await gRes.text();
      steps.push(`سبب الرفض من القاعدة: ${body.slice(0, 300)}`);
    } catch (e) { /* تجاهل */ }
    steps.push(`بصمة المفتاح المنشور: الطول ${SUPABASE_KEY.length} (الصحيح 208) | أوله ${SUPABASE_KEY.slice(0, 10)} | آخره ${SUPABASE_KEY.slice(-6)} (الصحيح BC3v8g)`);
    // تجربة ثانية: بترويسة apikey فقط بدون Authorization
    try {
      const alt = await fetch(
        `${SUPABASE_URL}/rest/v1/guests?qr_code=eq.${encodeURIComponent(code)}&select=event_id&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY } }
      );
      steps.push(`تجربة بطريقة مصادقة ثانية: HTTP ${alt.status}${alt.ok ? ' ✅ نجحت!' : ''}`);
      if (!alt.ok) { try { steps.push(`ردّها: ${(await alt.text()).slice(0, 200)}`); } catch (e) { /* تجاهل */ } }
    } catch (e) { steps.push(`تعذّرت التجربة الثانية: ${e.message}`); }
    return null;
  }

  const guests = await gRes.json();
  steps.push(`عدد النتائج: ${guests.length}`);
  if (!guests.length || !guests[0].event_id) { steps.push('❌ ما فيه ضيفة بهذا الكود'); return null; }
  steps.push(`✅ لقينا الضيفة — رقم المناسبة: ${guests[0].event_id}`);

  // 2) المناسبة → الصور
  const eRes = await fetch(
    `${SUPABASE_URL}/rest/v1/events?id=eq.${guests[0].event_id}&select=name,cover_image,preview_image&limit=1`,
    { headers: H }
  );
  steps.push(`استعلام المناسبة: HTTP ${eRes.status}`);
  if (!eRes.ok) { steps.push('❌ القاعدة رفضت استعلام المناسبة'); return null; }

  const events = await eRes.json();
  if (!events.length) { steps.push('❌ المناسبة مو موجودة'); return null; }

  const ev = events[0];
  steps.push(`✅ المناسبة: ${ev.name}`);
  steps.push(`غلاف المعاينة: ${ev.preview_image ? '✅ موجود' : '— فاضي'}`);
  steps.push(`صورة الدعوة: ${ev.cover_image ? '✅ موجود' : '— فاضي'}`);

  const image = ev.preview_image || ev.cover_image;
  if (!image) { steps.push('❌ ما فيه أي صورة — بتطلع الافتراضية'); return null; }
  if (image.startsWith('data:')) { steps.push('⚠️ الصورة محفوظة كنص مضغوط (data:) مو رابط — الواتساب ما يقبلها'); return null; }
  steps.push(`✅ الصورة النهائية: ${image.slice(0, 90)}…`);
  return image;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/(?:i\/)?([A-Za-z0-9-]{6,40})\/?$/);
  const code = m ? m[1] : null;

  // ── صفحة التشخيص الذاتي: /الكود?debug=og ──
  if (code && url.searchParams.get('debug') === 'og') {
    const steps = [`الدالة تشتغل ✅ — النسخة 2`, `الكود الملتقط: ${code}`];
    try { await lookupImage(code, steps); }
    catch (e) { steps.push(`❌ خطأ غير متوقع: ${e.message}`); }
    return new Response(steps.join('\n'), {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

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
    const image = await lookupImage(code, []);
    // نبدّل *الصورة فقط* بالغلاف — العنوان والوصف يبقون زي ما هم
    if (image) {
      html = injectMeta(html, 'og:image', image, 'property');
      html = injectMeta(html, 'twitter:image', image, 'name');
    }
  } catch (e) {
    // أي خطأ → الصفحة الأصلية بالصورة الافتراضية (ما نكسر شي)
  }

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
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
