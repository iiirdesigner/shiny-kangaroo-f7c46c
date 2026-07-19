// ═══════════════════════════════════════════════════════════════
//  R•Code — Edge Function لمعاينة الواتساب — النسخة 5
//  كل الروابط تطلع بغلافها المخصّص في كرت واتساب:
//   • دعوة الضيفة       rqr0.com/CODE   (أو /i/CODE)
//   • الرابط الموحد     rqr0.com/c/EVENT_ID
//   • تقرير الموحد      rqr0.com/or/EVENT_ID
//
//  الأولوية:  غلاف المعاينة  ←  صورة الدعوة  ←  شعار الموقع
//  الجديد في 5: يدعم روابط c/ و or/ برقم المناسبة عبر دالة آمنة.
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://lutfjdsuinaqswvgkmet.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1dGZqZHN1aW5hcXN3dmdrbWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNTYyMjQsImV4cCI6MjA5ODgzMjIyNH0.roY4YGSmYtsOC6TFtmgRZ9velYJzNQasIomITBC3v8g';

const AUTH = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'content-type': 'application/json',
};

// صورة معاينة بكود الضيفة (الدعوة العادية)
async function imageByCode(code, steps) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pub_preview_image`, {
    method: 'POST', headers: AUTH, body: JSON.stringify({ code_input: code }),
  });
  steps.push(`دعوة الضيفة: HTTP ${res.status}`);
  if (!res.ok) return null;
  return await res.json();
}

// صورة معاينة برقم المناسبة (الرابط الموحد وتقريره)
async function imageByEvent(eventId, steps) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pub_preview_by_event`, {
    method: 'POST', headers: AUTH, body: JSON.stringify({ event_input: eventId }),
  });
  steps.push(`الرابط الموحد: HTTP ${res.status}`);
  if (!res.ok) {
    try { steps.push(`ردّها: ${(await res.text()).slice(0, 200)}`); } catch (e) {}
    steps.push('❌ لو السبب Could not find the function — شغّلي معاينة-الرابط-الموحد.sql');
    return null;
  }
  return await res.json();
}

// نحلّل المسار: نوعه والمعرّف
function parsePath(pathname) {
  // الرابط الموحد وتقريره: /c/UUID أو /or/UUID
  let m = pathname.match(/^\/(c|or)\/([0-9a-fA-F-]{20,40})\/?$/);
  if (m) return { kind: 'event', id: m[2] };
  // دعوة الضيفة: /CODE أو /i/CODE
  m = pathname.match(/^\/(?:i\/)?([A-Za-z0-9-]{6,40})\/?$/);
  if (m) return { kind: 'code', id: m[1] };
  return { kind: null, id: null };
}

async function resolveImage(kind, id, steps) {
  const raw = kind === 'event' ? await imageByEvent(id, steps) : await imageByCode(id, steps);
  if (!raw) { steps.push('— ما فيه صورة، بتطلع الافتراضية'); return null; }
  if (typeof raw === 'string' && raw.startsWith('data:')) {
    steps.push('⚠️ الصورة data: مو رابط — الواتساب ما يقبلها'); return null;
  }
  steps.push(`✅ الصورة النهائية: ${String(raw).slice(0, 90)}…`);
  return raw;
}

export default async (request, context) => {
  const url = new URL(request.url);
  const { kind, id } = parsePath(url.pathname);

  // ── تشخيص ذاتي: أضيفي ?debug=og لأي رابط ──
  if (kind && url.searchParams.get('debug') === 'og') {
    const steps = [`الدالة تشتغل ✅ — النسخة 5`, `النوع: ${kind} | المعرّف: ${id}`];
    try { await resolveImage(kind, id, steps); }
    catch (e) { steps.push(`❌ خطأ: ${e.message}`); }
    return new Response(steps.join('\n'), {
      status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const response = await context.next();

  // تجاهل الملفات الحقيقية
  const last = url.pathname.split('/').pop() || '';
  if (!kind || /\.(html?|png|jpe?g|svg|ico|css|js|txt|json|xml|webmanifest)$/i.test(last)) {
    return response;
  }
  const ctype = response.headers.get('content-type') || '';
  if (!ctype.includes('text/html')) return response;

  let html;
  try { html = await response.text(); }
  catch (e) { return response; }

  try {
    const image = await resolveImage(kind, id, []);
    if (image) {
      html = injectMeta(html, 'og:image', image, 'property');
      html = injectMeta(html, 'twitter:image', image, 'name');
    }
  } catch (e) { /* الصفحة الأصلية بالافتراضية — ما نكسر شي */ }

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
