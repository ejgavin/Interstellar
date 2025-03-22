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

// Authentication if enabled
if (config.challenge !== false) {
  console.log(chalk.green("🔒 Password protection enabled"));
  app.use(basicAuth({ users: config.users, challenge: true }));
}

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

routes.forEach((route) => {
  app.get(route.path, (req, res) => {
    console.log(`📄 Serving page: ${route.file}`);
    res.sendFile(path.join(__dirname, "static", route.file));
  });
});

// Proxy and caching for /e/* assets
app.get("/e/*", async (req, res, next) => {
  try {
    if (cache.size > MAX_CACHE_SIZE) {
      cache.clear(); // Clear cache if it’s too big
    }

    if (cache.has(req.path)) {
      const { data, contentType, timestamp } = cache.get(req.path);
      if (Date.now() - timestamp > CACHE_TTL) {
        cache.delete(req.path);
      } else {
        console.log(`✅ Cache hit: ${req.path}`);
        res.writeHead(200, { "Content-Type": contentType });
        return res.end(data);
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

    if (!reqTarget) {
      return next();
    }

    console.log(`🔄 Fetching asset: ${reqTarget}`);
    const asset = await fetch(reqTarget, {
      method: req.method,
      headers: req.headers,
    });

    if (!asset.ok) {
      console.error(`❌ Failed to fetch asset: ${reqTarget}`);
      return next();
    }

    const data = Buffer.from(await asset.arrayBuffer());
    const ext = path.extname(reqTarget);
    const contentType = mime.getType(ext) || "application/octet-stream";

    cache.set(req.path, { data, contentType, timestamp: Date.now() });
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (error) {
    console.error("❌ Error fetching asset:", error);
    res.setHeader("Content-Type", "text/html");
    res.status(500).send("Error fetching the asset");
  }
});

// 🔑 Key validation setup
const VALID_KEYS = new Set(["validitiy"]); // Replace with actual keys

// 🔍 Key Validation for Direct Access
app.get("/fq", (req, res) => {
  const key = decodeURIComponent(req.query.key || "");
  console.log(`🔑 Received key: ${key}`);

  if (!key) {
    console.log("❌ No key provided.");
    return res.status(403).send("Access Denied: No Key Provided");
  }

  if (!VALID_KEYS.has(key)) {
    console.log(`❌ Invalid key attempt: ${key}`);
    return res.status(403).send("Access Denied: Invalid Key");
  }

  res.send("Iframe Request Successful!");
});

// 🌐 Proxy requests while preserving query parameters
app.get("/a/*", async (req, res) => {
  try {
    const encodedTargetUrl = req.params[0]; // Get the encoded part of the URL
    const decodedTargetUrl = decodeURIComponent(encodedTargetUrl); // Decode it
    const queryString = req.url.split("?")[1] || ""; // Preserve query params
    const fullUrl = `${decodedTargetUrl}?${queryString}`;

    console.log(`🔗 Proxying request to: ${fullUrl}`);

    // Fetch from the target URL
    const response = await fetch(fullUrl, {
      method: req.method,
      headers: req.headers,
    });

    if (!response.ok) {
      console.error(`❌ Proxy fetch failed: ${fullUrl}`);
      return res.status(response.status).send("Proxy Error");
    }

    const data = await response.buffer();
    const ext = path.extname(decodedTargetUrl);
    const contentType = mime.getType(ext) || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (error) {
    console.error("❌ Proxy error:", error);
    res.status(500).send("Proxy Error");
  }
});

// Handle Bare server requests
server.on("request", (req, res) => {
  if (bareServer.shouldRoute(req)) {
    console.log(`🛰️ Routing Bare server request: ${req.url}`);
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    console.log(`🛰️ WebSocket Upgrade: ${req.url}`);
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

server.on("listening", () => {
  console.log(chalk.green(`🌍 Server is running on http://localhost:${PORT}`));
});

server.listen({ port: PORT });
