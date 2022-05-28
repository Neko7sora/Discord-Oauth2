async function routes(fastify, options) {
  fastify.get("/auth/logout", async function (request, reply) {
    if (request.session.auth == "true") {
      request.session.destroy((err) => {
        if (err) {
          reply.status(500);
          reply.send("Internal Server Error");
        } else {
          reply.redirect("/auth/logout-wait");
        }
      });
      request.session.auth = false;
    } else {
      reply.redirect("/");
    }
  });
  fastify.get("/auth/logout-wait", (req, reply) => {
    reply.view("/view/pages.ejs", {
      pagetitle: "Loging out, please wait… | Zero Trust Application Access",
      pages: "auth/logout-wait",
    });
  });
}

module.exports = routes;
