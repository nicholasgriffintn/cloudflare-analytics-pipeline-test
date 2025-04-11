// Basic options for the tracker client
export interface TrackerOptions {
  siteId: string;
  endpoint?: string;
  eventEndpoint?: string;
  autoTrack?: boolean;
  debug?: boolean;
}

// Options for tracking pageviews
export interface TrackPageviewOptions {
  path?: string;
  contentType?: string;
  referrer?: string;
  language?: string;
}

// Options for tracking events
export interface TrackEventOptions {
  eventName: string;
  eventCategory?: string;
  eventLabel?: string;
  eventValue?: number;
  properties?: Record<string, unknown>;
}

// Main tracker class
export class Tracker {
  private options: TrackerOptions;
  private userId: string;

  constructor(options: TrackerOptions) {
    this.options = {
      endpoint: '/pixel',
      eventEndpoint: '/event',
      autoTrack: true,
      debug: false,
      ...options,
    };

    if (!this.options.siteId) {
      throw new Error('Site ID is required for tracker initialization');
    }

    this.userId = this.generateUserId();

    if (this.options.autoTrack && typeof window !== 'undefined') {
      // Auto-track page view on load
      if (document.readyState === 'complete') {
        this.trackPageview();
      } else {
        window.addEventListener('load', () => this.trackPageview());
      }
      
      // Track page views when the URL changes (for SPAs)
      this.setupHistoryTracking();
    }
  }

  private generateUserId(): string {
    // First try to get existing ID from localStorage
    try {
      const storedId = localStorage.getItem('analytics_user_id');
      if (storedId) return storedId;
    } catch (e) {
      // localStorage not available
    }

    // Generate a UUID-like ID for visitor tracking
    const newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    // Store for future use
    try {
      localStorage.setItem('analytics_user_id', newId);
    } catch (e) {
      // localStorage not available
    }
    
    return newId;
  }

  private setupHistoryTracking(): void {
    if (typeof window === 'undefined') return;
    
    // Track on popstate event (back/forward navigation)
    window.addEventListener('popstate', () => {
      this.trackPageview();
    });
    
    // Override history methods to track navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.trackPageview();
    };
    
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.trackPageview();
    };
  }

  private getScreenDimensions(): string {
    if (typeof window === 'undefined') return '';
    return `${window.screen.width}x${window.screen.height}x${window.screenX}x${window.screenY}`;
  }

  private getViewportDimensions(): string {
    if (typeof window === 'undefined') return '';
    return `${window.innerWidth}x${window.innerHeight}`;
  }

  /**
   * Get common query parameters for all tracking calls
   */
  private getCommonParams(): Record<string, string> {
    if (typeof window === 'undefined') return {};

    return {
      s: this.options.siteId, // Site ID
      ts: Date.now().toString(), // Timestamp
      vtag: '1.0.0', // Version tag
      r: this.getScreenDimensions(), // Screen dimensions
      re: this.getViewportDimensions(), // Viewport dimensions
      lng: navigator.language, // Language
      library_version: '1.0.0', // Library version
      app_name: 'analytics-pipeline', // App name
      app_type: 'web', // App type
      user_id: this.userId, // User ID
      p: window.location.pathname, // Page path
      ref: document.referrer, // Referrer
    };
  }

  // Track a pageview
  public trackPageview(options?: TrackPageviewOptions): void {
    if (typeof window === 'undefined') return;

    const currentPath = options?.path || window.location.pathname;
    const referrer = options?.referrer || document.referrer;
    const language = options?.language || navigator.language;
    const contentType = options?.contentType || 'page';

    const queryParams = {
      ...this.getCommonParams(),
      content_type: contentType, // Content type
      lng: language, // Override language if specified
      p: currentPath, // Override page path if specified
      ref: referrer, // Override referrer if specified
    };

    // Build query string
    const queryString = Object.entries(queryParams)
      .filter(([_, value]) => value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    // Send the tracking request using an image
    const img = new Image();
    img.src = `${this.options.endpoint}?${queryString}`;
    img.style.display = 'none';
    document.body.appendChild(img);
    
    // Remove the image after it loads or errors
    const cleanup = () => {
      if (img.parentNode) {
        img.parentNode.removeChild(img);
      }
    };
    img.onload = cleanup;
    img.onerror = cleanup;

    if (this.options.debug) {
      console.log('[Tracker] Tracking pageview:', queryParams);
    }
  }

  /**
   * Track a custom event
   */
  public trackEvent(options: TrackEventOptions): void {
    if (typeof window === 'undefined') return;

    const eventData = {
      siteId: this.options.siteId,
      eventName: options.eventName,
      eventCategory: options.eventCategory || 'interaction',
      eventLabel: options.eventLabel || '',
      eventValue: options.eventValue || 0,
      properties: options.properties || {},
      queryParams: this.getCommonParams(),
      timestamp: Date.now(),
    };

    // Send the event data using fetch with a POST request
    if (typeof fetch !== 'undefined') {
      fetch(this.options.eventEndpoint || '/event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
        // Using keepalive to ensure the request completes even if the page is being unloaded
        keepalive: true,
      }).catch(error => {
        if (this.options.debug) {
          console.error('[Tracker] Error tracking event:', error);
        }
      });

      if (this.options.debug) {
        console.log('[Tracker] Tracking event:', eventData);
      }
    } else if (this.options.debug) {
      console.error('[Tracker] Fetch API not available. Cannot track event.');
    }
  }
}

// Singleton implementation
let tracker: Tracker | undefined;

// Initialize the tracker
export function init(options: TrackerOptions): void {
  if (tracker) {
    throw new Error('Tracker has already been initialized');
  }
  tracker = new Tracker(options);
}

// Track a pageview
export function trackPageview(options?: TrackPageviewOptions): void {
  if (!tracker) {
    throw new Error('You must call init() before tracking pageviews');
  }
  tracker.trackPageview(options);
}

// Track an event
export function trackEvent(options: TrackEventOptions): void {
  if (!tracker) {
    throw new Error('You must call init() before tracking events');
  }
  tracker.trackEvent(options);
}

// Cleanup tracker
export function cleanup(): void {
  tracker = undefined;
}

// Export default functions
export default {
  init,
  trackPageview,
  trackEvent,
  cleanup,
}; 