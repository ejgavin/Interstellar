import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createBareServer } from "@nebula-services/bare-server-node";
import chalk from "chalk";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import basicAuth from "express-basic-auth";
import mime from "mime";
import fetch from "node-fetch";
import config from "./config.js";

console.log(chalk.yellow("🚀 Starting server..."));

const __dirname = process.cwd();
const server = http.createServer();
const app = express();
const bareServer = createBareServer("/fq/");
const PORT = process.env.PORT || 8080;
const cache = new Map();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // Cache for 30 Days
const MAX_CACHE_SIZE = 100;

const ALLOWED_ORIGIN = "https://ejgavin.github.io";
const VALID_API_KEYS = new Set(config.apiKeys || []); // Store valid API keys

// 🔒 Enable Basic Auth if configured
if (config.challenge !== false) {
  console.log(chalk.green("🔒 Password protection is enabled!"));
  Object.entries(config.users).forEach(([username, password]) => {
    console.log(chalk.blue(`Username: ${username}, Password: ${password}`));
  });
  app.use(basicAuth({ users: config.users, challenge: true }));
}

// 🔒 Middleware to enforce origin restrictions & API key authentication
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || "";
  const apiKey = req.headers["x-api-key"]; // Check for API key in headers

  if (!origin.startsWith(ALLOWED_ORIGIN) && !VALID_API_KEYS.has(apiKey)) {
    console.log(`⛔ Blocked request from: ${origin}`);
    return res.status(403).send("Access Denied");
  }

  next();
});

// 🔒 Security headers
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "geolocation=(self), microphone=()");
  next();
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, "static")));
app.use("/fq", cors({ origin: true }));

const routes = [
  { path: "/yz", file: "apps.html" },
  { path: "/up", file: "games.html" },
  { path: "/play.html", file: "games.html" },
  { path: "/vk", file: "settings.html" },
  { path: "/rx", file: "tabs.html" },
  { path: "/", file: "index.html" },
];

routes.forEach(route => {
  app.get(route.path, (_req, res) => {
    res.sendFile(path.join(__dirname, "static", route.file));
  });
});

// 404 handler
app.use((req, res, next) => {
  console.log(`404: ${req.originalUrl}`);
  res.status(404).sendFile(path.join(__dirname, "static", "404.html"));
});

// 500 handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, "static", "404.html"));
});

// 🔄 Caching and Proxy for /e/* routes
app.get("/e/*", async (req, res, next) => {
  try {
    if (cache.size > MAX_CACHE_SIZE) cache.clear();

    if (cache.has(req.path)) {
      const { data, contentType, timestamp } = cache.get(req.path);
      if (Date.now() - timestamp < CACHE_TTL) {
        res.writeHead(200, { "Content-Type": contentType });
        return res.end(data);
      } else {
        cache.delete(req.path);
      }
    }

    const baseUrls = {
      "/e/1/": "https://raw.githubusercontent.com/qrs/x/fixy/",
      "/e/2/": "https://raw.githubusercontent.com/3v1/V5-Assets/main/",
      "/e/3/": "https://raw.githubusercontent.com/3v1/V5-Retro/master/",
    };

    let reqTarget;
    for (const [prefix, baseUrl] of Object.entries(baseUrls)) {
      if (req.path.startsWith(prefix)) {
        reqTarget = baseUrl + req.path.slice(prefix.length);
        break;
      }
    }

    if (!reqTarget) return next();

    const asset = await fetch(reqTarget);
    if (!asset.ok) {
      console.error(`Failed to fetch asset: ${reqTarget}`);
      return next();
    }

    const data = Buffer.from(await asset.arrayBuffer());
    const ext = path.extname(reqTarget);
    const contentType = [".unityweb"].includes(ext) ? "application/octet-stream" : mime.getType(ext);

    cache.set(req.path, { data, contentType, timestamp: Date.now() });
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (error) {
    console.error("Error fetching asset:", error);
    res.status(500).send("Error fetching the asset");
  }
});

// Bare server handling
server.on("request", (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

server.on("listening", () => {
  console.log(chalk.green(`🌍 Server is running on http://localhost:${PORT}`));
});

server.listen({ port: PORT });
