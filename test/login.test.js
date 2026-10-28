const assert = require("node:assert/strict");
const { test } = require("node:test");
const loginRoutes = require("../routes/auth/login");

async function callbackHandler() {
  const routes = new Map();
  await loginRoutes({
    register() {},
    get(path, handler) { routes.set(path, handler); },
  });
  return routes.get("/auth/discord/callback");
}

test("OAuth callback unwraps the current token API and awaits native fetch before redirecting", async (t) => {
  const handler = await callbackHandler();
  const request = { session: {} };
  let redirect;
  const reply = { redirect(url) { redirect = url; return this; } };
  const token = { token_type: "Bearer", access_token: "test-token" };
  const requested = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requested.push(url);
    assert.equal(options.headers.authorization, "Bearer test-token");
    await new Promise((resolve) => setImmediate(resolve));
    return Response.json(url.endsWith("/guilds") ? [{ id: "test-guild" }] : {
      id: "test-user", username: "test", discriminator: "1234", avatar: "test-avatar",
    });
  });
  const result = await handler.call({
    discordOAuth2: {
      async getAccessTokenFromAuthorizationCodeFlow(actualRequest, actualReply) {
        assert.equal(actualRequest, request);
        assert.equal(actualReply, reply);
        return { token };
      },
    },
  }, request, reply);
  assert.equal(result, reply);
  assert.equal(redirect, "/auth/login-wait");
  assert.equal(requested.length, 2);
  assert.equal(request.session.auth, "true");
  assert.deepEqual(request.session.discorduser.guilds, [{ id: "test-guild" }]);
  assert.equal(request.session.discorduser.tag, "test#1234");
});

test("Discord API failures do not mark the session authenticated", async (t) => {
  const handler = await callbackHandler();
  for (const failAt of [1, 2]) {
    let calls = 0;
    const fetchMock = t.mock.method(globalThis, "fetch", async () => {
      if (++calls === failAt) return new Response(null, { status: 503 });
      return Response.json({ id: "test-user", username: "test" });
    });
    const request = { session: {} };
    await assert.rejects(handler.call({ discordOAuth2: {
      async getAccessTokenFromAuthorizationCodeFlow() {
        return { token: { token_type: "Bearer", access_token: "test-token" } };
      },
    } }, request, {}), /Failed to fetch Discord/);
    assert.equal(request.session.auth, undefined);
    fetchMock.mock.restore();
  }
});
