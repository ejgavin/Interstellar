window.addEventListener("load", () => {
  navigator.serviceWorker.register("../sw.js?v=10-02-2024", {
    scope: "/a/",
  });

  // Check if not on Chromebook and block access
  const allowedAgents = [
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
  ];
  const ua = navigator.userAgent;
  const blocker = document.getElementById("blocker");
  if (!allowedAgents.includes(ua) && blocker) {
    blocker.style.display = "flex";
  }

  // Lock Escape key on resize
  if (navigator.keyboard && navigator.keyboard.lock) {
    navigator.keyboard.lock(["Escape"]);
  }
});

const form = document.getElementById("fv");
const input = document.getElementById("iv");

if (form && input) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (window.top.location.pathname === "/rx") {
      processUrl(input.value, "");
    } else {
      processUrl(input.value, "/rx");
    }
  });
}

function processUrl(value, path) {
  let url = value.trim();
  const engine = localStorage.getItem("engine");
  const searchUrl = engine ? engine : "https://www.google.com/search?q=";

  if (!isUrl(url)) {
    url = searchUrl + url;
  } else if (!(url.startsWith("https://") || url.startsWith("http://"))) {
    url = `https://${url}`;
  }

  sessionStorage.setItem("GoUrl", __uv$config.encodeUrl(url));
  const dy = localStorage.getItem("dy");

  if (dy === "true") {
    window.location.href = `/a/q/${__uv$config.encodeUrl(url)}`;
  } else if (path) {
    location.href = path;
  } else {
    window.location.href = `/a/${__uv$config.encodeUrl(url)}`;
  }
}

function go(value) {
  processUrl(value, "/rx");
}

function blank(value) {
  processUrl(value);
}

function dy(value) {
  processUrl(value, `/a/q/${__uv$config.encodeUrl(value)}`);
}

function isUrl(val = "") {
  return (
    /^http(s?):\/\//.test(val) ||
    (val.includes(".") && val.substr(0, 1) !== " ")
  );
}
