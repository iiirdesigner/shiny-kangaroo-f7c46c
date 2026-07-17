// ═══════════════════════════════════════════════════════════════
//  R•Code — Edge Function لمعاينة الواتساب — النسخة 4
//  كل دعوة تطلع بغلافها المخصّص (أو صورة الدعوة) بكرت واتساب
//
//  الأولوية:  غلاف المعاينة  ←  صورة الدعوة  ←  شعار الموقع
//
//  الجديد في النسخة 4:
//  • القراءة عبر الدالة الآمنة pub_preview_image (ملف preview-rpc.sql)
//    بدل قراءة الجداول مباشرة — الجداول مقفولة عن الزوار وهذا صح.
//  • استعلام واحد بدل اثنين — أسرع للمعاينة.
//  • صفحة التشخيص باقية: rqr0.com/الكود?debug=og
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://lutfjdsuinaqswvgkmet.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1dGZqZHN1aW5hcXN3dmdrbWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTYyMjQsImV4cCI6MjA5ODgzMjIyNH0.roY4YGSmYtsOC6TFtmgRZ9velYJzNQasIomITBC3v8g';

// يجيب رابط صورة المعاينة عبر الدالة الآمنة — ويسجّل كل خطوة في steps
async function lookupImage(code, steps) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pub_preview_image`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ code_input: code }),
  });
  steps.push(`استعلام الدالة الآمنة: HTTP ${res.status}`);

  if (!res.ok) {
    try { steps.push(`سبب الرفض: ${(await res.text()).slice(0, 300)}`); } catch (e) { /* تجاهل */ }
    steps.push('❌ لو السبب يذكر Could not find the function — معناه ملف preview-rpc.sql ما تشغّل بعد في Supabase');
    return null;
  }

  const image = await res.json(); // نص الرابط أو null
  if (!image) { steps.push('❌ ما فيه صورة لهذا الكود (الكود غلط، أو المناسبة بدون غلاف وبدون صورة دعوة) — بتطلع الافتراضية'); return null; }
  if (typeof image === 'string' && image.startsWith('data:')) {
    steps.push('⚠️ الصورة محفوظة كنص مضغوط (data:) مو رابط — الواتساب ما يقبلها، بتطلع الافتراضية');
    return null;
  }
  steps.push(`✅ الصورة النهائية: ${String(image).slice(0, 90)}…`);
  return image;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/(?:i\/)?([A-Za-z0-9-]{6,40})\/?$/);
  const code = m ? m[1] : null;

  // ── صفحة التشخيص الذاتي: /الكود?debug=og ──
  if (code && url.searchParams.get('debug') === 'og') {
    const steps = [`الدالة تشتغل ✅ — النسخة 4`, `الكود الملتقط: ${code}`];
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
