async function routes(fastify, options) {
  fastify.get("/auth/check", async function (request, reply) {
    if (request.session.auth == "true") {
      request.session.kamepakenchi = "false";
      try {
        if (request.session.discorduser) {
          request.session.discorduser.guilds.filter(function (item, index) {
            if (item.id == "930083398691733565") {
              request.session.kamepakenchi = "true";
              //console.log("true");
            } else {
              //console.log("false");
            }
          });
          //console.log("true");
        } else {
          request.session.kamepakenchi = "false";
          //console.log("false");
        }
        reply.redirect("/");
      } catch (e) {}
    } else {
      reply.redirect("/");
    }
  });
}

module.exports = routes;
