/**
 * Cloudflare Pages Function — sends the inquiry to sales@easternlion.cn.
 *
 * The site is static, so the mail is sent from the edge: the browser posts the
 * inquiry here and this function hands it to Cloudflare Email Service through
 * the `send_email` binding (the same delivery pipeline and DKIM signing as the
 * SMTP endpoint, but without holding an API token in the worker).
 *
 * Two mails go out:
 *   1. the inquiry to the sales inbox as a real html table (series, every
 *      model with its own load and frequency, the drawing reference, the
 *      message and the contact block) plus a plain text part for the phones,
 *   2. a receipt to the visitor with the inquiry reference, so they know it
 *      arrived and can reach us on WhatsApp if it is urgent.
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
const WHATSAPP = 'https://wa.me/8613950513258';
const PHONE = '+86-13950513258';

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
    ref: 'Your inquiry reference',
    hello: 'Hello',
    thanks: 'Thank you for your inquiry. Our sales engineer has received it and will reply within one working day.',
    urgent: 'If it is urgent, message us on WhatsApp:',
    phoneLine: 'International department',
    sign: 'Kind regards,',
    companyLine: 'Fuan Eastern Lion Electric Machines Co., Ltd',
    address: 'No.36 XiaYang, BanZhong Industry Area, Fuan, Fujian, China',
    asked: 'What you asked for',
    yourMessage: 'Your message',
    received: 'We received your inquiry',
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
    ref: '您的询盘编号',
    hello: '您好',
    thanks: '感谢您的询盘。工程师已经收到，会在一个工作日内回复您。',
    urgent: '如果着急，请直接用 WhatsApp 联系我们：',
    phoneLine: '国际业务部',
    sign: '此致',
    companyLine: '福建东方电机股份有限公司',
    address: '福建省福安市坂中工业区下洋 36 号',
    asked: '您的询价内容',
    yourMessage: '您的留言',
    received: '我们已收到您的询盘',
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

/* the reference the visitor and the salesperson quote */
function reference() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
  const tail = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return 'EL-' + stamp + '-' + tail;
}

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
  const ref = reference();
  const subject = (str(data.subject, MAX.subject) || 'Generator set inquiry') + ' [' + ref + ']';

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

  /* ---------------------------------------------- the rows of the two tables */
  const machine = [];
  if (series) machine.push([L.series, series]);
  models.forEach((m) => {
    const bits = [m.model];
    if (m.load) bits.push(m.load + ' kW' + (m.hz ? ' @ ' + m.hz + ' Hz' : ''));
    machine.push([L.model, bits.join(' — ')]);
  });
  if (load && !models.some((m) => m.load)) {
    machine.push([L.power, load + ' kW' + (hz ? ' @ ' + hz + ' Hz' : '')]);
  }
  if (drawing) machine.push([L.drawing, drawing]);

  const contact = [];
  contact.push([L.name, name]);
  if (company) contact.push([L.company, company]);
  if (phone) contact.push([L.phone, phone]);
  contact.push([L.email, email]);
  if (page) contact.push([L.page, page]);

  /* ------------------------------------------------------------------ html */
  const htmlRow = ([label, value]) =>
    value
      ? '<tr>' +
        '<td style="padding:7px 16px 7px 0;color:#64748b;white-space:nowrap;vertical-align:top">' +
        esc(label) +
        '</td>' +
        '<td style="padding:7px 0;font-weight:600;color:#0f172a">' +
        esc(value) +
        '</td></tr>'
      : '';

  const htmlTable = (rows) =>
    rows.length
      ? '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 22px">' +
        rows.map(htmlRow).join('') +
        '</table>'
      : '';

  const html =
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">' +
    '<h2 style="margin:0 0 18px;font-size:20px;color:#0a1622">' +
    esc(L.title) +
    '</h2>' +
    htmlTable(machine) +
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
        htmlTable(contact)
      : '') +
    '<p style="margin:0;color:#94a3b8;font-size:13px">' +
    esc(L.replyNote) +
    '</p>' +
    '</div>';

  /* ------------------------------------------------------------------ text */
  const textRows = (rows) => rows.map(([label, value]) => label + ': ' + value).join('\n');

  const text =
    [
      L.title + ' [' + ref + ']',
      '',
      machine.length ? textRows(machine) : '',
      '',
      body ? L.message + ':\n' + body : '',
      '',
      L.contact + ':',
      textRows(contact),
    ]
      .filter((line) => line !== '')
      .join('\n');

  /* --------------------------------------------------------------- receipt */
  const receiptHtml =
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:640px">' +
    '<p style="margin:0 0 14px">' +
    esc(L.hello) +
    ' ' +
    esc(name) +
    ',</p>' +
    '<p style="margin:0 0 18px">' +
    esc(L.thanks) +
    '</p>' +
    '<p style="margin:0 0 18px;padding:12px 16px;background:#fff7ed;border-left:3px solid #f59e0b;border-radius:0 4px 4px 0">' +
    esc(L.ref) +
    ': <b>' +
    esc(ref) +
    '</b></p>' +
    (machine.length
      ? '<h3 style="margin:0 0 8px;font-size:15px;color:#0a1622">' +
        esc(L.asked) +
        '</h3>' +
        htmlTable(machine)
      : '') +
    (body
      ? '<h3 style="margin:0 0 8px;font-size:15px;color:#0a1622">' +
        esc(L.yourMessage) +
        '</h3>' +
        '<div style="white-space:pre-wrap;margin:0 0 18px;padding:12px 14px;background:#f8fafc;border-radius:4px">' +
        esc(body) +
        '</div>'
      : '') +
    (contact.length
      ? '<h3 style="margin:0 0 8px;font-size:15px;color:#0a1622">' +
        esc(L.contact) +
        '</h3>' +
        htmlTable(contact)
      : '') +
    '<p style="margin:0 0 6px">' +
    esc(L.urgent) +
    ' <a href="' +
    WHATSAPP +
    '" style="color:#0a66c2;font-weight:600">' +
    WHATSAPP +
    '</a></p>' +
    '<p style="margin:0 0 18px;color:#475569">' +
    esc(L.phoneLine) +
    ': ' +
    PHONE +
    '</p>' +
    '<p style="margin:0 0 4px">' +
    esc(L.sign) +
    '</p>' +
    '<p style="margin:0 0 2px;font-weight:600">' +
    esc(L.companyLine) +
    '</p>' +
    '<p style="margin:0;color:#94a3b8;font-size:13px">' +
    esc(L.address) +
    '</p>' +
    '</div>';

  const receiptText =
    [
      L.hello + ' ' + name + ',',
      '',
      L.thanks,
      '',
      L.ref + ': ' + ref,
      machine.length ? L.asked + ':\n' + textRows(machine) : '',
      body ? L.yourMessage + ':\n' + body : '',
      contact.length ? L.contact + ':\n' + textRows(contact) : '',
      '',
      L.urgent + ' ' + WHATSAPP,
      L.phoneLine + ': ' + PHONE,
      '',
      L.sign,
      L.companyLine,
      L.address,
    ]
      .filter((line) => line !== '')
      .join('\n');

  /* ----------------------------------------------------------------- send */
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

    /* the receipt for the visitor — a failure here must not fail the inquiry */
    try {
      await env.EMAIL.send({
        to: email,
        from: FROM,
        replyTo: TO,
        subject: L.received + ' [' + ref + ']',
        text: receiptText,
        html: receiptHtml,
      });
    } catch (receiptError) {
      console.error('the receipt could not be sent:', receiptError && receiptError.code);
    }

    return json({
      ok: true,
      id: result && result.messageId ? result.messageId : '',
      ref: ref,
    });
  } catch (error) {
    console.error('email sending failed:', error && error.code, error && error.message);
    return json({ ok: false, error: (error && error.code) || 'send-failed' }, 500);
  }
}

/* anything else is not allowed */
export async function onRequest() {
  return json({ ok: false, error: 'method-not-allowed' }, 405);
}
