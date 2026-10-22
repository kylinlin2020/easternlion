import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { join } from "path";
import { tmpdir } from "os";

const SOURCE = join(process.cwd(), "functions", "api", "inquiry.js");
if (!fs.existsSync(SOURCE)) {
  console.error("functions/api/inquiry.js not found");
  process.exit(1);
}

const dir = fs.mkdtempSync(join(tmpdir(), "el-fn-"));
const file = join(dir, "inquiry.mjs");
fs.copyFileSync(SOURCE, file);
const mod = await import(pathToFileURL(file).href);

function post(body, env) {
  return mod.onRequestPost({
    request: new Request("https://example.com/api/inquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    env: env || {},
  });
}

const inquiry = {
  name: "John Miller",
  email: "john@example.com",
  phone: "+86 139 0000 0000",
  company: "Example Ltd.",
  product: "GF/GFS-C200",
  series: "Engine By Cummins",
  drawing: "DW-2024-018",
  body: "Please quote 2 x 500 kW units for a data centre project in Jakarta.",
  models: [
    { model: "GF/GFS-C200", load: "500", hz: "60" },
    { model: "GF/GFS-YC450", load: "1000", hz: "50" },
  ],
  load: "500",
  hz: "60",
  lang: "en",
  subject: "Generator set inquiry: GF/GFS-C200",
  page: "https://www.easternlion.cn/contact/?product=GF/GFS-C200",
};

const problems = [];
function check(ok, what) {
  if (!ok) problems.push(what);
}

/* the mock binding collects every mail */
const sent = [];
const env = {
  EMAIL: {
    send: async (msg) => {
      sent.push(msg);
      return { messageId: "id-" + sent.length };
    },
  },
};

let res = await post(inquiry, env);
let json = await res.json();
check(res.status === 200, "the inquiry is accepted");
check(json.ok === true, "the inquiry reports ok");
check(!!json.ref, "the inquiry comes back with a reference");
check(/^EL-\d{8}-[A-Z0-9]{4}$/.test(json.ref || ""), "the reference looks like EL-20261022-4F7K");

/* two mails: the inquiry to the sales inbox and the receipt to the visitor */
check(sent.length === 2, "two mails are sent (the inquiry and the receipt)");
const toSales = sent.find((m) => m.to === "sales@easternlion.cn");
const toVisitor = sent.find((m) => m.to === "john@example.com");
check(!!toSales, "the inquiry goes to sales@easternlion.cn");
check(!!toVisitor, "the receipt goes to the visitor");
if (toSales) {
  check(toSales.replyTo === "john@example.com", "the inquiry replies to the visitor");
  check(toSales.subject.indexOf(json.ref) > -1, "the inquiry subject carries the reference");
  check(/<table/.test(toSales.html), "the inquiry is a html table");
  check(toSales.html.indexOf("GF/GFS-C200") > -1, "the mail carries the model");
  check(toSales.html.indexOf("500 kW") > -1, "the mail carries the load");
  check(toSales.html.indexOf("DW-2024-018") > -1, "the mail carries the drawing reference");
  check(toSales.text.length > 20, "the mail has a plain text part");
}
if (toVisitor) {
  check(toVisitor.replyTo === "sales@easternlion.cn", "the receipt replies to the sales inbox");
  check(toVisitor.subject.indexOf(json.ref) > -1, "the receipt subject carries the reference");
  check(toVisitor.html.indexOf(json.ref) > -1, "the receipt shows the reference");
  check(toVisitor.html.indexOf("wa.me") > -1, "the receipt offers WhatsApp");
  check(toVisitor.html.indexOf("John Miller") > -1, "the receipt greets the visitor by name");
}

/* a broken receipt must not fail the inquiry */
sent.length = 0;
let calls = 0;
res = await post(inquiry, {
  EMAIL: {
    send: async (msg) => {
      calls++;
      if (calls === 2) throw new Error("no receipt");
      sent.push(msg);
      return { messageId: "id-1" };
    },
  },
});
json = await res.json();
check(json.ok === true, "a failed receipt still leaves the inquiry sent");

/* a missing binding */
res = await post(inquiry, {});
check(res.status === 501, "a missing binding answers 501");

/* the validation */
for (const [label, payload] of [
  ["a missing name", { ...inquiry, name: "" }],
  ["an invalid address", { ...inquiry, email: "nope" }],
  ["a short body", { ...inquiry, body: "hi" }],
]) {
  res = await post(payload, env);
  check(res.status === 400, `${label} is rejected with 400 (got ${res.status})`);
}

/* the chinese path */
sent.length = 0;
res = await post({ ...inquiry, lang: "zh" }, env);
json = await res.json();
const zhReceipt = sent.find((m) => m.to === "john@example.com");
check(!!zhReceipt, "the chinese receipt is sent");
if (zhReceipt) {
  check(zhReceipt.subject.indexOf("\u6211\u4eec\u5df2\u6536\u5230") > -1, "the chinese receipt subject is chinese");
  check(zhReceipt.html.indexOf("\u60a8\u7684\u8be2\u76d8\u7f16\u53f7") > -1, "the chinese receipt shows the reference label");
  check(zhReceipt.text.indexOf("\u56fd\u9645\u4e1a\u52a1\u90e8") > -1, "the chinese receipt names our department");
}

/* the robot */
sent.length = 0;
res = await post({ ...inquiry, website: "http://spam.example" }, env);
check(res.status === 200, "the honeypot is answered with 200");
check(sent.length === 0, "the honeypot sends nothing");

if (problems.length) {
  console.log(`INQUIRY FUNCTION PROBLEMS (${problems.length}):`);
  problems.forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log("OK: the inquiry function sends a table mail to the sales inbox, a receipt with a reference to the visitor, and refuses everything else.");
