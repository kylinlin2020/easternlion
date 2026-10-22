/**
 * Cloudflare Pages Function — sends the inquiry to sales@easternlion.cn.
 *
 * The site is static, so the mail is sent from the edge: the browser posts the
 * inquiry here and this function hands it to Cloudflare Email Service through
 * the `send_email` binding (the same delivery pipeline and DKIM signing as the
 * SMTP endpoint, but without holding an API token in the worker).
 *
 * The binding is restricted to one destination:
 *
 *   [[send_email]]
 *   name = "EMAIL"
 *   destination_address = "sales@easternlion.cn"
 *
 * Configure in wrangler.toml and add the binding in the Cloudflare dashboard
 * (Settings > Functions > Bindings > Send email).
 */

const TO = 'sales@easternlion.cn';
const FROM = 'sales@easternlion.cn';

const MAX = {
  body: 20000,
  subject: 200,
  name: 120,
  email: 200,
  phone: 60,
  company: 160,
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'invalid' }, 400);
  }
  if (!data || typeof data !== 'object') return json({ ok: false, error: 'invalid' }, 400);

  /* a hidden field that only a robot would fill */
  if (data.website) return json({ ok: true });

  const body = str(data.body, MAX.body);
  const name = str(data.name, MAX.name);
  const email = str(data.email, MAX.email);
  const phone = str(data.phone, MAX.phone);
  const company = str(data.company, MAX.company);
  const subject = str(data.subject, MAX.subject) || 'Generator set inquiry';

  if (!name) return json({ ok: false, error: 'name' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ ok: false, error: 'email' }, 400);
  }
  if (body.length < 10) return json({ ok: false, error: 'message' }, 400);

  const models = Array.isArray(data.models) ? data.models.slice(0, 12).map((m) => str(m, 120)).filter(Boolean) : [];
  const load = str(data.load, 20);
  const hz = str(data.hz, 10);
  const lang = str(data.lang, 5) || 'en';
  const page = str(data.page, 300);

  const rows = [];
  if (models.length) rows.push(['Models', models.join(', ')]);
  if (load) rows.push(['Required power', load + ' kW' + (hz ? ' @ ' + hz + ' Hz' : '')]);
  if (company) rows.push(['Company', company]);
  if (phone) rows.push(['Phone', phone]);
  if (page) rows.push(['Page', page]);

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a">' +
    '<h2 style="margin:0 0 12px">Generator set inquiry</h2>' +
    '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px">' +
    rows
      .map(
        ([k, v]) =>
          '<tr><td style="border-bottom:1px solid #e2e8f0;color:#64748b">' +
          escapeHtml(k) +
          '</td><td style="border-bottom:1px solid #e2e8f0"><b>' +
          escapeHtml(v) +
          '</b></td></tr>'
      )
      .join('') +
    '</table>' +
    '<pre style="white-space:pre-wrap;font-family:inherit;margin:0;line-height:1.7">' +
    escapeHtml(body) +
    '</pre>' +
    '<p style="color:#94a3b8;margin:20px 0 0">Reply to this mail reaches the visitor directly.</p>' +
    '</div>';

  if (!env.EMAIL || typeof env.EMAIL.send !== 'function') {
    return json({ ok: false, error: 'not-configured' }, 501);
  }

  try {
    const result = await env.EMAIL.send({
      to: TO,
      from: FROM,
      replyTo: email,
      subject: subject,
      text: body + '\n\n---\n' + rows.map(([k, v]) => k + ': ' + v).join('\n'),
      html,
    });
    return json({ ok: true, id: result && result.messageId ? result.messageId : '' });
  } catch (error) {
    console.error('email sending failed:', error && error.code, error && error.message);
    return json({ ok: false, error: (error && error.code) || 'send-failed' }, 500);
  }
}

/* anything else is not allowed */
export async function onRequest() {
  return json({ ok: false, error: 'method-not-allowed' }, 405);
}
