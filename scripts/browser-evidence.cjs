// Browser-based evidence: all backend operations here use the real running Spring Boot
// application and its temporary CI MySQL, Redis and RabbitMQ services.
// The AI screenshot documents the UI, not a successful paid model response.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const OUT = path.join(__dirname, "../Notes/screenshots");
const stamp = Date.now().toString(36);
const username = "browser" + stamp;
const password = "browser-test-password-123";
const title = "CI 浏览器测试笔记 " + stamp;
const body = "这是一篇由真实浏览器提交、RabbitMQ 消费并写入 MySQL 的测试笔记。";
fs.mkdirSync(OUT, { recursive: true });

async function requireVisible(locator, explanation, timeout = 15000) {
    await locator.waitFor({ state: "visible", timeout }).catch(() => {
        throw new Error(explanation);
    });
}
async function check(result, description) {
    if (!result) throw new Error(description);
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
        viewport: { width: 1600, height: 930 },
        deviceScaleFactor: 1
    });
    try {
        await page.goto(BASE_URL, { waitUntil: "networkidle" });
        await requireVisible(page.locator("#authOverlay"), "Login page was not visible");
        await page.screenshot({ path: path.join(OUT, "01-login.png"), fullPage: true });
        console.log("PASS browser: login/register page rendered");

        await page.locator("#registerTab").click();
        await page.locator("#usernameInput").fill(username);
        await page.locator("#passwordInput").fill(password);
        await page.locator("#authSubmit").click();
        await page.waitForFunction(() =>
            document.getElementById("authSubmit")?.textContent?.trim() === "登录",
            null, { timeout: 15000 }
        );

        await page.locator("#usernameInput").fill(username);
        await page.locator("#passwordInput").fill(password);
        await page.locator("#authSubmit").click();
        await page.waitForFunction(() =>
            document.getElementById("authOverlay")?.classList.contains("hidden"),
            null, { timeout: 15000 }
        );
        console.log("PASS browser: registered and signed in with real Session");

        await page.locator("#newNoteButton").click();
        await page.locator("#noteTitle").fill(title);
        await page.locator("#noteContent").fill(body);
        await page.locator("#saveNoteButton").click();
        await page.waitForFunction(t =>
            Array.from(document.querySelectorAll(".note-item-title"))
                .some(x => x.textContent.trim() === t),
            title, { timeout: 25000 }
        );

        await requireVisible(page.getByText(title, { exact: true }).first(),
            "Created note was not visible in list");
        await page.screenshot({ path: path.join(OUT, "02-notes.png"), fullPage: true });
        console.log("PASS browser: created and displayed a note through real HTTP/MQ/MySQL");

        await page.locator("#newChatButton").click();
        await requireVisible(page.locator("#chatInput"), "AI chat field was not visible");
        await page.screenshot({ path: path.join(OUT, "03-ai-ui.png"), fullPage: true });
        console.log("PASS browser: AI chat UI and new conversation control rendered (no live API call)");

        // Render *actual* captured logs as a readable evidence image.
        // This is a log visualization, not a screenshot purporting to be from a local terminal.
        const smoke = fs.readFileSync("/tmp/jotang-smoke.log", "utf8");
        const server = fs.readFileSync("/tmp/jotang-server.log", "utf8");
        await check(smoke.includes("PASS: register/login"), "Smoke test success line missing");
        const mq = server.split(/\r?\n/).filter(line =>
            line.includes("MQ received:") || line.includes("MQ created note id="));
        await check(mq.some(line => line.includes("CREATE")), "No CREATE consumer evidence");
        await check(mq.some(line => line.includes("UPDATE")), "No UPDATE consumer evidence");
        await check(mq.some(line => line.includes("DELETE")), "No DELETE consumer evidence");

        const evidencePage = await browser.newPage({
            viewport: { width: 1300, height: 820 }, deviceScaleFactor: 1
        });
        await evidencePage.setContent(
            '<style>*{box-sizing:border-box}body{background:#f0f2f5;margin:0;padding:35px;' +
            'font:15px/1.6 ui-monospace,Menlo,Consolas,monospace;color:#dae6dc}' +
            '.window{background:#111b17;border-radius:16px;padding:28px;box-shadow:0 16px 50px #102b2233}' +
            'h1{font:700 22px/1.2 system-ui;color:#fff;margin:0 0 10px}' +
            '.sub{color:#99b4a6;margin:0 0 26px;font:13px system-ui}' +
            'pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}' +
            '.ok{color:#89e1a9}</style>' +
            '<div class="window"><h1>JotangNote · 实际 CI 运行日志</h1>' +
            '<p class="sub">来源：GitHub Actions / real MySQL + Redis + RabbitMQ。以下文字来自本次测试日志，非模型生成。</p>' +
            '<pre id="log"></pre></div>'
        );
        await evidencePage.locator("#log").evaluate((el, lines) => {
            el.textContent = lines.join("\n");
        }, [
            "[HTTP smoke test]",
            smoke.trim(),
            "",
            "[RabbitMQ consumer output]",
            ...mq.slice(-16)
        ]);
        await evidencePage.screenshot({
            path: path.join(OUT, "04-verified-ci-log.png"), fullPage: true
        });
        console.log("PASS evidence: rendered screenshot from verified CI smoke and RabbitMQ logs");
        await evidencePage.close();
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
