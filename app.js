require("dotenv").config();
// Require the framework and instantiate it
const split = require("split2");
const fs = require("fs");
const now = Date.now();
const stream = split(JSON.parse)
  .on("data", function (obj) {
    //each chunk now is a js object
    fs.appendFileSync("./logs/" + now + ".log", JSON.stringify(obj) + "\n");
  })
  .on("error", function (error) {
    //handling parsing errors
    console.log(error);
    fs.appendFileSync(
      "./logs/" + now + "-error.log",
      JSON.stringify(error) + "\n"
    );
  });

const fastify = require("fastify")({
  logger: {
    level: "info",
    stream: stream,
  },
});
const fastifySession = require("@fastify/session");
const fastifyCookie = require("@fastify/cookie");
fastify.register(require("point-of-view"), {
  engine: {
    ejs: require("ejs"),
  },
});
fastify.register(require("@fastify/helmet"), {
  enableCSPNonces: false,
  contentSecurityPolicy: false,
});
fastify.register(fastifyCookie);
const crypto = require("crypto").randomBytes(256).toString("hex");
fastify.register(fastifySession, {
  cookieName: "sessionId",
  secret: crypto,
  cookie: { secure: process.env.COOKIE_SECURE },
  expires: 1800000,
});
const { proxy, close } = require("fast-proxy")({
  base: process.env.PROXY,
  cacheURLs: 0,
});

fastify.get("/auth", (request, reply) => {
  if (request.session.auth == "true") {
    if (request.session.discord_guild_join == "true") {
      reply.view("/view/pages.ejs", {
        pagetitle: "Index | Zero Trust Application Access",
        pages: "auth/index",
      });
    } else {
      reply.view("/view/pages.ejs", {
        pagetitle: "Error | Zero Trust Application Access",
        pages: "auth/error",
      });
    }
  } else {
    reply.view("/view/pages.ejs", {
      pagetitle: "Log in | Zero Trust Application Access",
      pages: "auth/login",
    });
  }
});

fastify.get("/robots.txt", (request, reply) => {
  reply.view("/view/robots.ejs", {});
});
fastify.get("/auth/info", (request, reply) => {
  reply.view("/view/pages.ejs", {
    pagetitle: "Info | Zero Trust Application Access",
    pages: "auth/info",
    discorduser: request.session.discorduser,
  });
});

fastify.register(require("./routes/auth/login"));
fastify.register(require("./routes/auth/logout"));
fastify.register(require("./routes/auth/check"));

fastify.get("/*", (request, reply) => {
  if (request.session.auth == "true") {
    if (request.session.discord_guild_join == "true") {
      proxy(request, reply.raw, request.url, {});
    } else {
      reply.view("/view/pages.ejs", {
        pagetitle: "Error | Zero Trust Application Access",
        pages: "auth/error",
      });
    }
  } else {
    reply.redirect("/auth");
  }
});

// Run the server!
const start = async () => {
  try {
    await fastify.listen(process.env.PORT);
    console.log("listening on port", process.env.PORT);
    fastify.log.info("!cookie-secret: " + crypto);
    console.log("log", now);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
