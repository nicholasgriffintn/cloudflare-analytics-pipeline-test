import { Hono } from "hono";

const app = new Hono();

function extractDeviceInfo(userAgent) {
  let browser = "Unknown";
  let os = "Unknown";
  let device = "Unknown";

  if (!userAgent) {
    return { browser, os, device };
  }

  // Extract browser
  if (userAgent.includes("Firefox")) {
    browser = "Firefox";
  } else if (userAgent.includes("Chrome")) {
    browser = "Chrome";
  } else if (userAgent.includes("Safari")) {
    browser = "Safari";
  } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
    browser = "Opera";
  } else if (userAgent.includes("Edge")) {
    browser = "Edge";
  } else if (userAgent.includes("MSIE") || userAgent.includes("Trident/")) {
    browser = "Internet Explorer";
  }

  // Extract OS
  if (userAgent.includes("Win")) {
    os = "Windows";
  } else if (userAgent.includes("Mac")) {
    os = "MacOS";
  } else if (userAgent.includes("Linux")) {
    os = "Linux";
  } else if (userAgent.includes("Android")) {
    os = "Android";
  } else if (userAgent.includes("iOS")) {
    os = "iOS";
  }

  // Extract device
  const mobileKeywords = [
    "Android",
    "webOS",
    "iPhone",
    "iPad",
    "iPod",
    "BlackBerry",
    "Windows Phone",
  ];
  device = mobileKeywords.some((keyword) => userAgent.includes(keyword))
    ? "Mobile"
    : "Desktop";

  return { browser, os, device };
}

app.get("/collect", async (c) => {
  // TODO: This is just boilerplate, needs to be expanded for a use case.
  const { userAgent } = c.req.header();
  const { ip } = c.req.raw;
  const { referer } = c.req.header();
  const { url } = c.req.raw;
  const { path } = c.req.raw;
  const { method } = c.req.raw;

  const { browser, os, device } = extractDeviceInfo(userAgent);

  const timestamp = new Date().toISOString();

  const data = {
    timestamp,
    session_id: "1234567890abcdef", // For production use a unique session ID
    user_id: `user${Math.floor(Math.random() * 1000)}`, // For production use a unique user ID
    event_data: {
      event_id: Math.floor(Math.random() * 1000),
      event_type: "test",
      page_url: url,
      timestamp,
    },
    device_info: {
      browser,
      os,
      device,
      userAgent,
    },
    referrer: "NA",
    ip,
  };
  
  return c.json({
    success: true,
    data,
  });
});

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
};