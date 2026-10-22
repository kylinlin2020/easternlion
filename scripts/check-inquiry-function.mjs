/**
 * Test for the Cloudflare Pages Function that sends the inquiry.
 *
 *   node scripts/check-inquiry-function.mjs
 *
 * The function is an ES module, the repository is not ("type" is not set in
 * package.json), so it is copied to a temporary .mjs file and imported from
 * there. The email binding is replaced by a mock.
 */
import { pathToFileURL } from "url";
import { join } from "path";
import { tmpdir } from "os";
import { copyFileSync, mkdtempSync } from "fs";
import { existsSync } from "fs";
import { tmpdir as tmp } from "os";

const SOURCE = join(process.cwd(), "functions", "api", "inquiry.js");
if (!existsSync(SOURCE)) {
  console.error("functions/api/inquiry.js not found");
  process.exit(1);
}

const dir = mkdtempSync(join(tmp(), "el-fn-"));
const file = join(dir, "inquiry.mjs");
copyFileSync(SOURCE, file);
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
  company: "Example Ltd.",
  phone: "+86 139 0000 0000",
  product: "GF/GFS-C200",
  models: ["GF/GFS-C200 (Engine By Cummins)"],
  load: "500",
  hz: "60",
  subject: "Generator set inquiry: GF/GFS-C200",
  body:
    "Dear Eastern Lion sales team,\n\nI am interested in the following generator set(s):\n\n" +
    "  Model          : GF/GFS-C200\n  Required power : 500 kW @ 60 Hz\n\n" +
    "Message:\nPlease quote 2 units.\n\nContact\n  Name    : John Miller\n  E-mail  : john@example.com\n",
  lang: "en",
  page: "https://www.easternlion.cn/contact/?product=GF/GFS-C200&load=500&hz=60",
};

const problems = [];
function check(ok, what) {
  if (!ok) problems.push(what);
}

let sent = null;
const env = {
  EMAIL: {
    send: async (msg) => {
      sent = msg;
      return { messageId: "abc-123" };
    },
  },
};

/* 1. the happy path */
let res = await post(inquiry, env);
check(res.status === 200, `the happy path returns 200 (got ${res.status})`);
let json = await res.json();
check(json.ok === true, "the happy path reports ok");
check(sent && sent.to === "sales@easternlion.cn", "the mail goes to sales@easternlion.cn");
check(sent && sent.replyTo === "john@example.com", "the reply-to is the visitor");
check(sent && !!sent.text && !!sent.html, "the mail has a text and an html part");
check(sent && sent.html.includes("GF/GFS-C200"), "the html carries the model");
check(sent && !sent.html.includes("<script"), "the html is escaped");
check(sent && !sent.subject.includes("<"), "the subject is plain");

/* 2. the site without the binding (local preview) */
res = await post(inquiry, {});
check(res.status === 501, "a missing binding answers 501");

/* 3. a refused send */
const realError = console.error;
console.error = () => {};
res = await post(inquiry, {
  EMAIL: {
    send: async () => {
      const e = new Error("denied");
      e.code = "E_SENDER_NOT_VERIFIED";
      throw e;
    },
  },
});
console.error = realError;
check(res.status === 500, "a refused send answers 500");

/* 4. the validation */
for (const [label, payload] of [
  ["a missing name", { ...inquiry, name: "" }],
  ["an invalid address", { ...inquiry, email: "nope" }],
  ["a short body", { ...inquiry, body: "hi" }],
]) {
  res = await post(payload, env);
  check(res.status === 400, `${label} is rejected with 400 (got ${res.status})`);
}

/* 5. a robot that filled the hidden field */
sent = null;
res = await post({ ...inquiry, website: "http://spam.example" }, env);
check(res.status === 200, "the honeypot is answered with 200");
check(sent === null, "the honeypot sends nothing");

/* 6. another method */
res = await mod.onRequest();
check(res.status === 405, "another method answers 405");

if (problems.length) {
  console.log(`INQUIRY FUNCTION PROBLEMS (${problems.length}):`);
  problems.forEach((p) => console.log("  " + p));
  process.exit(1);
}
console.log("OK: the inquiry function sends to sales@easternlion.cn, validates the payload and refuses everything else.");
