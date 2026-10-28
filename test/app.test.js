const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { once } = require("node:events");
const { test } = require("node:test");

test("updated plugins render pages, keep sessions and proxy authenticated requests", async (t) => {
  const upstream = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ url: request.url }));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  t.after(() => new Promise((resolve) => upstream.close(resolve)));

  Object.assign(process.env, {
    DISCORD_CLIENT_ID: "test-client",
    DISCORD_CLIENT_SECRET: "test-secret",
    DISCORD_GUILD_ID: "test-guild",
    OAUTH2_CALLBACK: "http://localhost:3000",
    COOKIE_SECURE: "false",
    PROXY: `http://127.0.0.1:${upstream.address().port}`,
  });
  const app = require("../app");
  t.after(() => app.close());
  app.get("/test/session", (request) => {
    request.session.auth = "true";
    request.session.discorduser = { guilds: [{ id: "test-guild" }] };
    return { ok: true };
  });

  for (const url of ["/auth", "/auth/info", "/auth/login-wait", "/auth/logout-wait", "/auth/check-wait"]) {
    const response = await app.inject(url);
    assert.equal(response.statusCode, 200, url);
    assert.match(response.headers["content-type"], /text\/html/);
  }
  const robots = await app.inject("/robots.txt");
  assert.equal(robots.statusCode, 200);
  assert.match(robots.body, /Disallow: \//);

  const denied = await app.inject("/private");
  assert.equal(denied.statusCode, 302);
  assert.equal(denied.headers.location, "/auth");

  const login = await app.inject("/auth/discord");
  assert.equal(login.statusCode, 302);
  const authorize = new URL(login.headers.location);
  assert.equal(authorize.origin, "https://discord.com");
  assert.equal(authorize.searchParams.get("client_id"), "test-client");
  assert.equal(authorize.searchParams.get("scope"), "identify guilds");
  assert.ok(login.cookies.some((cookie) => cookie.name === "oauth2-redirect-state"));

  const invalidCallback = await app.inject("/auth/discord/callback?code=invalid&state=invalid");
  assert.equal(invalidCallback.statusCode, 500);
  assert.match(invalidCallback.json().message, /state/i);

  const seeded = await app.inject("/test/session");
  const session = seeded.cookies.find((cookie) => cookie.name === "sessionId");
  assert.ok(session);
  assert.equal(session.secure, undefined);
  const cookies = { sessionId: session.value };
  const check = await app.inject({ url: "/auth/check", cookies });
  assert.equal(check.statusCode, 302);
  assert.equal(check.headers.location, "/auth/check-wait");

  const proxied = await app.inject({ url: "/private?value=123", cookies });
  assert.equal(proxied.statusCode, 200);
  assert.deepEqual(proxied.json(), { url: "/private?value=123" });

  const logout = await app.inject({ url: "/auth/logout", cookies });
  assert.equal(logout.statusCode, 302);
  assert.equal(logout.headers.location, "/auth/logout-wait");
  const afterLogout = await app.inject({ url: "/private", cookies });
  assert.equal(afterLogout.statusCode, 302);
  assert.equal(afterLogout.headers.location, "/auth");
});
