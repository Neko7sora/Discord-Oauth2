async function routes(fastify, options) {
  fastify.get("/auth/check", async function (request, reply) {
    if (request.session.auth == "true") {
      request.session.discord_guild_join = "false";
      try {
        if (request.session.discorduser) {
          request.session.discorduser.guilds.filter(function (item, index) {
            if (item.id == process.env.DISCORD_GUILD_ID) {
              request.session.discord_guild_join = "true";
            }
          });
        } else {
          request.session.discord_guild_join = "false";
        }
        reply.redirect("/auth/check-wait");
      } catch (e) {}
    } else {
      reply.redirect("/auth");
    }
  });
  fastify.get("/auth/check-wait", (req, reply) => {
    reply.view("/view/pages.ejs", {
      pagetitle: "Checking..., please wait… | Zero Trust Application Access",
      pages: "auth/check-wait",
    });
  });
}

module.exports = routes;
