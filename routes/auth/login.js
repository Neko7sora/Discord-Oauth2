async function routes(fastify, options) {
  const oauthPlugin = require("@fastify/oauth2");
  const fetch = require("node-fetch");
  fastify.register(oauthPlugin, {
    name: "discordOAuth2",
    scope: ["identify", "guilds"],
    credentials: {
      client: {
        id: process.env.CLIENT_ID,
        secret: process.env.CLIENT_SECRET,
      },
      auth: oauthPlugin.DISCORD_CONFIGURATION,
    },
    // register a fastify url to start the redirect flow
    startRedirectPath: "/auth/discord",
    // facebook redirect here after the user login
    callbackUri: process.env.DOMAIN + "/auth/discord/callback",
  });

  fastify.get("/auth/discord/callback", async function (request, reply) {
    let token =
      await this.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

    request.session.discordcallback = token;
    request.session.auth = "true";

    fetch("https://discord.com/api/users/@me", {
      method: "GET",
      headers: {
        authorization: `${token.token_type} ${token.access_token}`,
      },
    })
      .then((res2) => (request.session.res2 = res2.json()))
      .then((userResponse) => {
        userResponse.tag = `${userResponse.username}#${userResponse.discriminator}`;
        userResponse.username = userResponse.username;
        userResponse.dis = userResponse.discriminator;
        userResponse.id = userResponse.id;
        userResponse.mfa = userResponse.mfa_enabled;
        userResponse.locale = userResponse.locale;
        userResponse.tag = `${userResponse.username}#${userResponse.discriminator}`;
        userResponse.avatarURL = userResponse.avatar
          ? `https://cdn.discordappcom/avatars/${userResponse.id}/${userResponse.avatar}.png?size=1024`
          : null;
        request.session.discorduser = userResponse;

        fetch("https://discord.com/api/users/@me/guilds", {
          method: "GET",
          headers: {
            authorization: `${token.token_type} ${token.access_token}`,
          },
        })
          .then((res2) => res2.json())
          .then((guildsResponse) => {
            request.session.discorduser.guilds = guildsResponse;
            reply.redirect("/auth/login-wait");
          });
      });
  });
  fastify.get("/auth/login-wait", (req, reply) => {
    reply.view("/view/pages.ejs", {
      pagetitle: "Loging in, please wait… | Zero Trust Application Access",
      pages: "auth/login-wait",
    });
  });
}

module.exports = routes;
