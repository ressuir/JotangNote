// End-to-end paid API smoke test, triggered intentionally via GitHub Actions.
// Uses the real frontend, Spring Boot, MySQL, RabbitMQ, Redis, and DeepSeek.
// Never writes credentials, cookies, or request headers into the evidence.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const OUT = path.join(__dirname, "../Notes/screenshots");
const RUN = process.env.GITHUB_RUN_ID || "local";
const stamp = Date.now().toString(36);
const username = "ai" + stamp;
const password = "temporary-test-password-123";
const title = "AI 真人接口验证 " + stamp;
const marker = "RECORD" + stamp.toUpperCase() + "Q7";
const memoryWord = "REMEMBER" + stamp.toUpperCase() + "C4";
const noteBody = "自动化测试用笔记。校验标识：" + marker + "。请勿改动。";
const screenshotPath = path.join(OUT, "05-ai-live.png");
fs.mkdirSync(OUT, { recursive: true });

async function waitForNote(page) {
    await page.waitForFunction(t => [...document.querySelectorAll(".note-item-title")]
        .some(e => e.textContent.trim() === t), title, { timeout: 25000 });
    const button = page.locator(".note-item").filter({ hasText: title }).first();
    const id = Number(await button.getAttribute("data-note-id"));
    assert(Number.isSafeInteger(id) && id > 0, "Missing newly created note ID");
    return id;
}

async function askAI(page, prompt, tag, expectedSubstring) {
    await page.locator("#chatInput").fill(prompt);
    const responsePromise = page.waitForResponse(
        r => r.url().endsWith("/chat") && r.request().method() === "POST",
        { timeout: 120000 }
    );
    await page.locator("#sendChatButton").click();
    const response = await responsePromise;
    let body = {};
    try { body = await response.json(); } catch { }
    if (response.status() !== 200) {
        throw new Error(tag + " HTTP " + response.status() + ": " + String(body.message || "").slice(0, 180));
    }
    assert.equal(typeof body.reply, "string", tag + ": reply should be a string");
    assert(body.reply.trim().length > 0, tag + ": reply should not be blank");
    if (expectedSubstring) {
        assert(
            body.reply.toUpperCase().includes(expectedSubstring.toUpperCase()),
            tag + ": expected verification string not present in model reply"
        );
    }
    await page.waitForFunction(
        t => [...document.querySelectorAll(".message.assistant .message-body")]
            .some(x => x.textContent.trim() === t),
        body.reply,
        { timeout: 10000 }
    );
    console.log("PASS live DeepSeek: " + tag + " (HTTP 200; nonempty reply)");
    return body.reply;
}

async function registerAndLoginViaApi(context, name) {
    const register = await context.post(BASE_URL + "/api/auth/register", {
        data: { username: name, password }
    });
    assert.equal(register.status(), 200, "Second-user register failed");
    const login = await context.post(BASE_URL + "/api/auth/login", {
        data: { username: name, password }
    });
    assert.equal(login.status(), 200, "Second-user login failed");
}

async function main() {
    assert(process.env.DEEPSEEK_API_KEY, "DEEPSEEK_API_KEY missing in CI");
    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext({
            viewport: { width: 1600, height: 930 }, deviceScaleFactor: 1
        });
        const page = await context.newPage();
        await page.goto(BASE_URL, { waitUntil: "networkidle" });
        await page.locator("#registerTab").click();
        await page.locator("#usernameInput").fill(username);
        await page.locator("#passwordInput").fill(password);
        await page.locator("#authSubmit").click();
        await page.waitForFunction(() =>
            document.querySelector("#authSubmit")?.textContent.trim() === "登录", null,
            { timeout: 15000 }
        );
        await page.locator("#usernameInput").fill(username);
        await page.locator("#passwordInput").fill(password);
        await page.locator("#authSubmit").click();
        await page.waitForFunction(() =>
            document.querySelector("#authOverlay")?.classList.contains("hidden"), null,
            { timeout: 15000 }
        );
        console.log("PASS live setup: real browser registration and Session login");

        await page.locator("#newNoteButton").click();
        await page.locator("#noteTitle").fill(title);
        await page.locator("#noteContent").fill(noteBody);
        await page.locator("#saveNoteButton").click();
        const noteId = await waitForNote(page);
        console.log("PASS live setup: note created by browser and RabbitMQ (id=" + noteId + ")");

        await askAI(page,
            "请用一句简短的中文解释 HTTP 202 状态码。",
            "plain chat");

        await askAI(page,
            "请记住这个临时校验词：" + memoryWord + "。这只是测试。回复“已记住”即可。",
            "memory first turn");

        await askAI(page,
            "请只回复我上一条消息让你记住的临时校验词，不要添加其他文字。",
            "multi-turn memory", memoryWord);

        const readPrompt = "请调用 get_note 工具查询 ID 为 " + noteId +
            " 的笔记，读取它的真实正文。然后只回复正文里的校验标识。不能猜测，也不要复述我的问题。";
        await askAI(page, readPrompt, "get_note tool call with real DB content", marker);

        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log("PASS live evidence: actual AI reply screenshot saved");

        const otherUser = await browser.newContext();
        try {
            await registerAndLoginViaApi(otherUser.request, username + "b");
            const response = await otherUser.request.post(BASE_URL + "/chat", {
                data: { message: "请使用 get_note 工具读取 ID 为 " + noteId +
                    " 的笔记，并给出正文中完整的校验标识。" },
                timeout: 120000
            });
            assert.equal(response.status(), 200,
                "Cross-user AI call should return a safe assistant answer");
            const result = await response.json();
            assert.equal(typeof result.reply, "string", "Cross-user AI reply invalid");
            assert(!result.reply.includes(marker),
                "SECURITY FAILURE: AI leaked another user's note marker");
            console.log("PASS live security: second user's AI chat cannot read the note");
        } finally {
            await otherUser.close();
        }

        // Real CI evidence, containing no API key, cookies or secret user data.
        const date = new Date().toISOString();
        const report = [
            "# DeepSeek 在线端到端测试",
            "",
            "执行时间（UTC）：\`" + date + "\`",
            "",
            "GitHub Actions：[查看运行记录](https://github.com/ressuir/JotangNote/actions/runs/" + RUN + ")",
            "",
            "模型：\`deepseek-flash\`，非思考模式；真实调用后端 \`POST /chat\`。",
            "",
            "| 场景 | 实际检查 | 结果 |",
            "| --- | --- | --- |",
            "| 普通 AI 回复 | 浏览器调用 /chat，HTTP 200，回复非空 | PASS |",
            "| 多轮对话 | 记住动态校验词，下一轮能准确复述 | PASS |",
            "| Tool Use | 创建 MySQL 笔记，模型调用 get_note 并复述正文中没有出现在提问里的动态标识 | PASS |",
            "| 用户隔离 | 第二个账号通过 AI 读取第一位用户的笔记，不能得到校验标识 | PASS |",
            "| 浏览器 | 实际登录、创建笔记、显示模型回复并保存截图 | PASS |",
            "",
            "![真实在线 AI 测试截图](screenshots/05-ai-live.png)",
            "",
            "说明：测试使用仅供测试的临时笔记与随机字符串，不输出 API Key、用户 Cookie。测试通过表明上述具体场景可用，不意味着覆盖全部故障场景。",
            ""
        ].join("\n");
        fs.writeFileSync(path.join(__dirname, "../Notes/AI-在线测试报告.md"), report, "utf8");
        console.log("PASS: all live DeepSeek end-to-end checks succeeded");
    } finally {
        await browser.close();
    }
}

main().catch(err => {
    console.error("FAIL live DeepSeek: " + (err?.stack || err));
    process.exitCode = 1;
});