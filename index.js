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

const __dirname = process.cwd();
const server = http.createServer();
const app = express();
const bareServer = createBareServer("/fq/");
const PORT = process.env.PORT || 8080;
const cache = new Map();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // Cache for 30 Days
const MAX_CACHE_SIZE = 100;

// Function to format time in 12-hour format with AM/PM in EST
function formatTime(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let seconds = date.getSeconds();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; // Convert 0 to 12 for AM format
  minutes = minutes.toString().padStart(2, "0");
  seconds = seconds.toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds} ${ampm}`;
}

// Log exact time and user agent when a request is made
app.use((req, res, next) => {
  const now = new Date();
  // Convert to Eastern Standard Time (EST)
  const estDate = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  const formattedTime = formatTime(new Date(estDate));
  const formattedDate = new Date(estDate).toLocaleDateString("en-US");
  const userAgent = req.get("User-Agent") || "Unknown";

  // Only log the time and user agent, not the full URL
  console.log(`[${formattedDate} ${formattedTime}] User-Agent: ${userAgent}`);
  next();
});

if (config.challenge !== false) {
  app.use(basicAuth({ users: config.users, challenge: true }));
}

app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "geolocation=(self), microphone=()");
  next();
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, "build"))); // Assuming the build folder is in the same directory

app.use("/fq", cors({ origin: true }));

// Define routes for static files
const routes = [
  { path: "/yz", file: "apps.html" },
  { path: "/up", file: "games.html" },
  { path: "/play.html", file: "games.html" },
  { path: "/vk", file: "settings.html" },
  { path: "/rx", file: "tabs.html" },
  { path: "/", file: "index.html" },
];

routes.forEach((route) => {
  app.get(route.path, (_req, res) => {
    res.sendFile(path.join(__dirname, "static", route.file));
  });
});

// 404 and error handlers
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, "static", "404.html"));
});

app.use((err, req, res, next) => {
  res.status(500).sendFile(path.join(__dirname, "static", "404.html"));
});

// Your existing caching logic for assets
app.get("/e/*", async (req, res, next) => {
  // ... (existing caching logic remains the same)
});

// Handle requests using the bareServer routing
server.on("request", (req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

// Upgrade requests handling for WebSocket
server.on("upgrade", (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.end();
  }
});

server.listen({ port: PORT });
