import { Hono } from "hono";

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  ANALYTICS_PIPELINE: {
    send(records: Record<string, unknown>[]): Promise<void>;
  };
}

const app = new Hono<{ Bindings: Env }>();

// Get midnight date for visitor tracking
function getMidnightDate(): Date {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

// Get next modified date for cookieless tracking
function getNextLastModifiedDate(current: Date | null): Date {
  // Handle invalid date
  if (current && Number.isNaN(current.getTime())) {
    const originalCurrent = current;
    current = null;
  }

  const midnight = getMidnightDate();

  // Check if new day, if it is then set to midnight
  let next = current ? current : midnight;
  next = midnight.getTime() - next.getTime() > 0 ? midnight : next;

  // Next seconds value is the current seconds value + 1, capped at 3
  const currentSeconds = next.getSeconds();
  next.setSeconds(Math.min(3, currentSeconds + 1));

  return next;
}

// Calculate bounce value based on hit count
function getBounceValue(hits: number): number {
  if (hits === 1) {
    return 1; // First hit = bounce
  }
  if (hits === 2) {
    return -1; // Second hit = anti-bounce
  }
  return 0; // Third+ hit = normal
}

// Check if the visitor is new based on If-Modified-Since header
function checkVisitorSession(ifModifiedSince: string | null): {
  newVisitor: boolean;
} {
  let newVisitor = true;

  if (ifModifiedSince) {
    // Check if today is a new day vs ifModifiedSince
    const today = new Date();
    const ifModifiedSinceDate = new Date(ifModifiedSince);
    if (
      today.getFullYear() === ifModifiedSinceDate.getFullYear() &&
      today.getMonth() === ifModifiedSinceDate.getMonth() &&
      today.getDate() === ifModifiedSinceDate.getDate()
    ) {
      // If ifModifiedSince is today, this is not a new visitor
      newVisitor = false;
    }
  }

  return { newVisitor };
}

// Handle cache headers for cookieless tracking
function handleCacheHeaders(ifModifiedSince: string | null): {
  hits: number;
  nextLastModifiedDate: Date;
} {
  const { newVisitor } = checkVisitorSession(ifModifiedSince);
  const nextLastModifiedDate = getNextLastModifiedDate(
    ifModifiedSince ? new Date(ifModifiedSince) : null,
  );

  // Calculate hits from the seconds component of the date
  // If it's a new day or first visit, hits will be 1
  // Otherwise, it's based on the seconds value, but capped at 3
  let hits = newVisitor ? 1 : nextLastModifiedDate.getSeconds();

  // Cap the hit count at 3 to avoid exposing exact hit counts publicly
  if (hits > 3) {
    hits = 3;
  }

  return {
    hits,
    nextLastModifiedDate,
  };
}

function extractDeviceInfo(userAgent?: string) {
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

// Extract screen dimensions from the 'r' parameter (e.g., 1800x1169x30x30)
function parseScreenDimensions(dimensionStr: string) {
  if (!dimensionStr) return null;
  
  const parts = dimensionStr.split('x');
  if (parts.length < 2) return null;
  
  return {
    width: Number.parseInt(parts[0], 10) || 0,
    height: Number.parseInt(parts[1], 10) || 0,
    offsetX: parts.length > 2 ? (Number.parseInt(parts[2], 10) || 0) : 0,
    offsetY: parts.length > 3 ? (Number.parseInt(parts[3], 10) || 0) : 0,
  };
}

// Collect standard analytics data common to both pageviews and events
function collectCommonAnalyticsData(c: any, queryParams: Record<string, string>, isPageView = true) {
  const { userAgent } = c.req.header();
  const ifModifiedSince = c.req.header('if-modified-since');
  const ip = c.req.raw.headers.get("CF-Connecting-IP") || "unknown";
  const { referer } = c.req.header();
  const url = c.req.url;
  const path = new URL(c.req.url).pathname;
  
  // Extract query parameters
  const {
    s: siteId = "",
    ts: timestamp = "",
    vtag: versionTag = "",
    r: screenDimensions = "",
    re: viewportDimensions = "",
    lng: language = "",
    content_type: contentType = "",
    library_version: libraryVersion = "",
    app_name: appName = "",
    app_type: appType = "",
    user_id: userId = "",
    p: pagePath = "", // Page path
    ref: referrer = referer || "", // Referrer
  } = queryParams;

  // Get cookieless tracking information - only for pageviews
  let hits = 0;
  let isVisit = false;
  let bounceValue = 0;
  let nextLastModifiedDate: Date | undefined;

  if (isPageView) {
    // Get hit count from cache headers
    const cacheResult = handleCacheHeaders(ifModifiedSince || null);
    hits = cacheResult.hits;
    nextLastModifiedDate = cacheResult.nextLastModifiedDate;

    isVisit = hits === 1; // if first hit, it is a visit
    bounceValue = getBounceValue(hits);
  }

  const { browser, os, device } = extractDeviceInfo(userAgent);
  const parsedScreenDimensions = parseScreenDimensions(screenDimensions);
  const parsedViewport = parseScreenDimensions(viewportDimensions);
  const currentTimestamp = new Date().toISOString();

  const analyticsData = {
    timestamp: currentTimestamp,
    session_data: {
      site_id: siteId,
      client_timestamp: timestamp || Date.now().toString(),
      user_id: userId || `user${Math.floor(Math.random() * 1000)}`,
      hits,
      new_visitor: isVisit ? 1 : 0,
      bounce: bounceValue,
    },
    event_data: {
      event_id: Math.floor(Math.random() * 1000),
      version_tag: versionTag,
      content_type: contentType,
    },
    app_data: {
      app_name: appName,
      app_type: appType,
      library_version: libraryVersion,
      language: language,
    },
    device_info: {
      browser,
      os,
      device,
      userAgent,
      screen: parsedScreenDimensions,
      viewport: parsedViewport,
    },
    referrer: referrer || "NA",
    page: {
      url,
      path: pagePath || path,
    },
    ip,
    raw_query_params: queryParams,
  };

  return { analyticsData, nextLastModifiedDate };
}

// Endpoint for tracking pageviews using 1x1 tracking pixel
app.get("/pixel", async (c) => {
  const queryParams = c.req.query();
  
  const { analyticsData, nextLastModifiedDate } = collectCommonAnalyticsData(c, queryParams);

  // Send to analytics pipeline
  await c.env.ANALYTICS_PIPELINE.send([analyticsData]);
  
  // Create 1x1 transparent GIF for tracking pixel
  const gif = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  const gifData = atob(gif);
  const gifLength = gifData.length;
  const arrayBuffer = new ArrayBuffer(gifLength);
  const uintArray = new Uint8Array(arrayBuffer);
  for (let i = 0; i < gifLength; i++) {
    uintArray[i] = gifData.charCodeAt(i);
  }

  const headers: HeadersInit = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "image/gif",
    "Expires": "Mon, 01 Jan 1990 00:00:00 GMT",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Tk": "N", // not tracking
  };

  if (nextLastModifiedDate) {
    headers["Last-Modified"] = nextLastModifiedDate.toUTCString();
  }

  // Return the tracking pixel
  return new Response(arrayBuffer, {
    headers,
    status: 200,
  });
});

// New endpoint for tracking events with richer data
app.post("/event", async (c) => {
  // Parse the event data
  let eventData;
  try {
    eventData = await c.req.json();
  } catch (e) {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  // Validate required fields
  if (!eventData.siteId || !eventData.eventName) {
    return c.json({ error: "Missing required fields: siteId and eventName" }, 400);
  }

  // Get common data from query parameters or empty object if none
  const queryParams = eventData.queryParams || {};
  
  // Add the site ID to query params for common data collection
  queryParams.s = eventData.siteId;
  
  // Get common analytics data without pageview specific tracking
  const { analyticsData } = collectCommonAnalyticsData(c, queryParams, false);
  
  // Merge with event-specific data
  const fullEventData = {
    ...analyticsData,
    event_data: {
      ...analyticsData.event_data,
      event_name: eventData.eventName,
      event_category: eventData.eventCategory || "interaction",
      event_label: eventData.eventLabel || "",
      event_value: eventData.eventValue || 0,
    },
    properties: eventData.properties || {},
    data_type: "event",
  };

  // Send to analytics pipeline
  await c.env.ANALYTICS_PIPELINE.send([fullEventData]);

  // Return success response
  return c.json({ success: true }, 200);
});

// CORS preflight for the event endpoint
app.options("/event", (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
});

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
};