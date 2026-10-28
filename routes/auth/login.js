async function routes(fastify, options) {
  const oauthPlugin = require("@fastify/oauth2");
  fastify.register(oauthPlugin, {
    name: "discordOAuth2",
    scope: ["identify", "guilds"],
    credentials: {
      client: {
        id: process.env.DISCORD_CLIENT_ID,
        secret: process.env.DISCORD_CLIENT_SECRET,
      },
      auth: oauthPlugin.DISCORD_CONFIGURATION,
    },
    // register a fastify url to start the redirect flow
    startRedirectPath: "/auth/discord",
    // facebook redirect here after the user login
    callbackUri: process.env.OAUTH2_CALLBACK + "/auth/discord/callback",
  });

  fastify.get("/auth/discord/callback", async function (request, reply) {
    const { token } =
      await this.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(request, reply);
    if (token.token_type && token.access_token) {
      const userResult = await fetch("https://discord.com/api/users/@me", {
        method: "GET",
        headers: {
          authorization: `${token.token_type} ${token.access_token}`,
        },
      });
      if (!userResult.ok) {
        throw new Error("Failed to fetch Discord user");
      }
      const userResponse = await userResult.json();
      userResponse.tag = `${userResponse.username}#${userResponse.discriminator}`;
      userResponse.dis = userResponse.discriminator;
      userResponse.mfa = userResponse.mfa_enabled;
      userResponse.avatarURL = userResponse.avatar
        ? `https://cdn.discordapp.com/avatars/${userResponse.id}/${userResponse.avatar}.png?size=1024`
        : null;

      const guildsResult = await fetch("https://discord.com/api/users/@me/guilds", {
        method: "GET",
        headers: {
          authorization: `${token.token_type} ${token.access_token}`,
        },
      });
      if (!guildsResult.ok) {
        throw new Error("Failed to fetch Discord guilds");
      }
      userResponse.guilds = await guildsResult.json();
      request.session.discordcallback = token;
      request.session.discorduser = userResponse;
      request.session.auth = "true";
      return reply.redirect("/auth/login-wait");
    } else {
      return reply.redirect("/auth");
    }
  });
  fastify.get("/auth/login-wait", (req, reply) => {
    reply.view("/view/pages.ejs", {
      pagetitle: "Loging in, please wait… | Zero Trust Application Access",
      pages: "auth/login-wait",
    });
  });
}

module.exports = routes;
