/**
 * Cloudflare Pages Function — sends the inquiry to sales@easternlion.cn.
 *
 * The site is static, so the mail is sent from the edge: the browser posts the
 * inquiry here and this function hands it to Cloudflare Email Service through
 * the `send_email` binding (the same delivery pipeline and DKIM signing as the
 * SMTP endpoint, but without holding an API token in the worker).
 *
 * The mail is a real html table — the salesperson opens it in Outlook and sees
 * the model, the load, the frequency, the drawing reference and the message in
 * a table instead of a wall of plain text. A plain text part travels with it
 * for the phone clients.
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
  series: 160,
  drawing: 200,
  page: 300,
  load: 20,
  hz: 10,
};

const LABELS = {
  en: {
    title: 'Generator set inquiry',
    series: 'Series',
    model: 'Model',
    power: 'Required power',
    drawing: 'Drawing / spec reference',
    message: 'Message',
    contact: 'Contact',
    name: 'Name',
    company: 'Company',
    phone: 'Phone / WhatsApp',
    email: 'E-mail',
    page: 'Page',
    replyNote: 'Reply to this mail reaches the visitor directly.',
  },
  zh: {
    title: '发电机组询价',
    series: '系列',
    model: '机型',
    power: '需求功率',
    drawing: '图纸 / 技术要求编号',
    message: '留言',
    contact: '联系方式',
    name: '姓名',
    company: '公司',
    phone: '电话 / WhatsApp',
    email: '邮箱',
    page: '来源页面',
    replyNote: '直接回复本邮件即可回复访客。',
  },
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
  String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) =>
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
  const series = str(data.series, MAX.series);
  const drawing = str(data.drawing, MAX.drawing);
  const page = str(data.page, MAX.page);
  const load = str(data.load, MAX.load);
  const hz = str(data.hz, MAX.hz);
  const lang = str(data.lang, 5) === 'zh' ? 'zh' : 'en';
  const subject = str(data.subject, MAX.subject) || 'Generator set inquiry';

  if (!name) return json({ ok: false, error: 'name' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ ok: false, error: 'email' }, 400);
  }
  if (body.length < 10) return json({ ok: false, error: 'message' }, 400);

  /* the models arrive as { model, load, hz } rows (or as plain strings) */
  const models = [];
  if (Array.isArray(data.models)) {
    data.models.slice(0, 12).forEach((m) => {
      if (m && typeof m === 'object') {
        const model = str(m.model, 120);
        if (!model) return;
        models.push({ model, load: str(m.load, MAX.load), hz: str(m.hz, MAX.hz) });
      } else {
        const model = str(m, 120);
        if (model) models.push({ model, load: '', hz: '' });
      }
    });
  }

  const L = LABELS[lang];
  const esc = escapeHtml;

  const row = (label, value) =>
    value
      ? '<tr>' +
        '<td style="padding:7px 16px 7px 0;color:#64748b;white-space:nowrap;vertical-align:top">' +
        esc(label) +
        '</td>' +
        '<td style="padding:7px 0;font-weight:600;color:#0f172a">' +
        esc(value) +
        '</td></tr>'
      : '';

  /* the machine table */
  const machine = [];
  if (series) machine.push(row(L.series, series));
  models.forEach((m) => {
    const bits = [m.model];
    if (m.load) bits.push(m.load + ' kW' + (m.hz ? ' @ ' + m.hz + ' Hz' : ''));
    machine.push(row(L.model, bits.join(' — ')));
  });
  if (load && !models.some((m) => m.load)) {
    machine.push(row(L.power, load + ' kW' + (hz ? ' @ ' + hz + ' Hz' : '')));
  }
  if (drawing) machine.push(row(L.drawing, drawing));

  /* the contact table */
  const contact = [];
  if (name) contact.push(row(L.name, name));
  if (company) contact.push(row(L.company, company));
  if (phone) contact.push(row(L.phone, phone));
  if (email) contact.push(row(L.email, email));
  if (page) contact.push(row(L.page, page));

  const html =
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">' +
    '<h2 style="margin:0 0 18px;font-size:20px;color:#0a1622">' +
    esc(L.title) +
    '</h2>' +
    (machine.length
      ? '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px">' +
        machine.join('') +
        '</table>'
      : '') +
    (body
      ? '<h3 style="margin:0 0 8px;font-size:15px;color:#0a1622">' +
        esc(L.message) +
        '</h3>' +
        '<div style="white-space:pre-wrap;margin:0 0 22px;padding:14px 16px;background:#f8fafc;border-left:3px solid #f59e0b;border-radius:0 4px 4px 0">' +
        esc(body) +
        '</div>'
      : '') +
    (contact.length
      ? '<h3 style="margin:0 0 8px;font-size:15px;color:#0a1622">' +
        esc(L.contact) +
        '</h3>' +
        '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px">' +
        contact.join('') +
        '</table>'
      : '') +
    '<p style="margin:0;color:#94a3b8;font-size:13px">' +
    esc(L.replyNote) +
    '</p>' +
    '</div>';

  /* the plain text part for the phone clients */
  const text = [
    L.title,
    '',
    series ? L.series + ': ' + series : '',
    models
      .map((m) => L.model + ': ' + m.model + (m.load ? ' (' + m.load + ' kW' + (m.hz ? ' @ ' + m.hz + ' Hz' : '') + ')' : ''))
      .join('\n'),
    load ? L.power + ': ' + load + ' kW' + (hz ? ' @ ' + hz + ' Hz' : '') : '',
    drawing ? L.drawing + ': ' + drawing : '',
    '',
    body,
    '',
    L.contact + ':',
    L.name + ': ' + name,
    company ? L.company + ': ' + company : '',
    phone ? L.phone + ': ' + phone : '',
    L.email + ': ' + email,
    page ? L.page + ': ' + page : '',
  ]
    .filter((line) => line !== '')
    .join('\n');

  if (!env.EMAIL || typeof env.EMAIL.send !== 'function') {
    return json({ ok: false, error: 'not-configured' }, 501);
  }

  try {
    const result = await env.EMAIL.send({
      to: TO,
      from: FROM,
      replyTo: email,
      subject,
      text,
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
