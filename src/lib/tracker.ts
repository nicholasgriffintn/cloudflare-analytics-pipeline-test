// Enhanced version of tracker.ts with batching, offline support, and more features

// Basic options for the tracker client
export interface TrackerOptions {
  siteId: string;
  eventEndpoint?: string;
  batchEndpoint?: string;
  autoTrack?: boolean;
  debug?: boolean;
  batchSize?: number;
  flushInterval?: number;
  enableOfflineTracking?: boolean;
  sessionTimeout?: number; // In minutes
  samplingRate?: number; // 0-100
  manualFlush?: boolean; // If true, events will only be flushed when flushEvents() is called
}

// Options for tracking pageviews
export interface TrackPageviewOptions {
  path?: string;
  contentType?: string;
  referrer?: string;
  language?: string;
  title?: string;
  virtualPageview?: boolean;
}

// Options for tracking events
export interface TrackEventOptions {
  eventName: string;
  eventCategory?: string;
  eventLabel?: string;
  eventValue?: number;
  properties?: Record<string, unknown>;
  nonInteraction?: boolean;
}

// Define event type for queue
export interface QueuedEvent {
  type: 'event' | 'pageview';
  eventName?: string;
  eventCategory?: string;
  eventLabel?: string;
  path?: string;
  contentType?: string;
  title?: string;
  timestamp?: number;
  [key: string]: unknown;
}

// Session data interface
export interface SessionData {
  id: string;
  startTime: number;
  lastActivity: number;
  pageviews: number;
  events: number;
  initialReferrer: string;
  initialLandingPage: string;
}

// Queue status interface
export interface QueueStatus {
  queueLength: number;
  events: Array<QueuedEvent>;
  connectionStatus: 'online' | 'offline';
  manualFlush: boolean;
}

// Main tracker class
export class Tracker {
  private options: TrackerOptions;
  private userId: string;
  private sessionData: SessionData;
  private eventQueue: Array<QueuedEvent> = [];
  private isSending = false;
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private sessionInterval: ReturnType<typeof setInterval> | null = null;
  private connectionStatus: 'online' | 'offline' = 'online';

  constructor(options: TrackerOptions) {
    this.options = {
      eventEndpoint: '/event',
      batchEndpoint: '/batch',
      autoTrack: true,
      debug: false,
      batchSize: 10,
      flushInterval: 10000, // 10 seconds
      enableOfflineTracking: true,
      sessionTimeout: 30, // 30 minutes
      samplingRate: 100, // 100% sampling by default
      manualFlush: false, // Auto flush by default
      ...options,
    };

    if (!this.options.siteId) {
      throw new Error('Site ID is required for tracker initialization');
    }

    // Initialize user ID
    this.userId = this.generateUserId();
    
    // Initialize session
    this.sessionData = this.initializeSession();

    // Initialize batching and connectivity monitoring
    if (typeof window !== 'undefined') {
      this.initBatchProcessing();
      this.initConnectivityTracking();
      this.initSessionTracking();
    }

    if (this.options.autoTrack && typeof window !== 'undefined') {
      // Auto-track page view on load
      if (document.readyState === 'complete') {
        this.trackPageview();
      } else {
        window.addEventListener('load', () => this.trackPageview());
      }
      
      // Track page views when the URL changes (for SPAs)
      this.setupHistoryTracking();
      
      // Track performance metrics
      this.trackPerformance();
      
      // Track visibility
      this.trackVisibility();
      
      // Track errors
      this.trackErrors();
    }
  }

  // Sample events based on sampling rate
  private shouldSampleEvent(): boolean {
    if (this.options.samplingRate === 100) return true;
    if (this.options.samplingRate === 0) return false;
    return Math.random() * 100 < (this.options.samplingRate || 100);
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

  private generateSessionId(): string {
    return 'sxxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private initializeSession(): SessionData {
    let sessionData: SessionData;
    
    try {
      // Try to retrieve existing session
      const storedSession = localStorage.getItem('analytics_session');
      if (storedSession) {
        sessionData = JSON.parse(storedSession);
        
        // Check if session timed out
        const sessionTimeoutMs = (this.options.sessionTimeout || 30) * 60 * 1000;
        if (Date.now() - sessionData.lastActivity > sessionTimeoutMs) {
          // Session expired, create new one
          sessionData = this.createNewSession();
        }
      } else {
        // No existing session, create new one
        sessionData = this.createNewSession();
      }
    } catch (e) {
      // Error retrieving session, create new one
      sessionData = this.createNewSession();
    }
    
    return sessionData;
  }

  private createNewSession(): SessionData {
    const currentTime = Date.now();
    const session: SessionData = {
      id: this.generateSessionId(),
      startTime: currentTime,
      lastActivity: currentTime,
      pageviews: 0,
      events: 0,
      initialReferrer: typeof document !== 'undefined' ? document.referrer : '',
      initialLandingPage: typeof window !== 'undefined' ? window.location.pathname : '',
    };
    
    try {
      localStorage.setItem('analytics_session', JSON.stringify(session));
    } catch (e) {
      // localStorage not available
    }
    
    if (this.options.debug) {
      console.log('[Tracker] New session created:', session);
    }
    
    return session;
  }

  private updateSession(): void {
    this.sessionData.lastActivity = Date.now();
    
    try {
      localStorage.setItem('analytics_session', JSON.stringify(this.sessionData));
    } catch (e) {
      // localStorage not available
    }
  }

  private initSessionTracking(): void {
    // Update session on activity
    const activityEvents = ['click', 'scroll', 'keypress', 'mousemove'];
    for (const eventType of activityEvents) {
      window.addEventListener(eventType, () => this.updateSession(), { passive: true });
    }
    
    // Regularly check for session timeout
    this.sessionInterval = setInterval(() => {
      const sessionTimeoutMs = (this.options.sessionTimeout || 30) * 60 * 1000;
      if (Date.now() - this.sessionData.lastActivity > sessionTimeoutMs) {
        // Session expired, create new one
        this.sessionData = this.createNewSession();
        if (this.options.debug) {
          console.log('[Tracker] Session timed out, new session created');
        }
      }
    }, 60000); // Check every minute
  }

  private initConnectivityTracking(): void {
    // Set initial connection status
    this.connectionStatus = navigator.onLine ? 'online' : 'offline';
    
    // Listen for connection changes
    window.addEventListener('online', () => {
      this.connectionStatus = 'online';
      if (this.options.debug) {
        console.log('[Tracker] Connection restored. Flushing events.');
      }
      
      // Only auto-flush when connection is restored if manual flush is not enabled
      if (!this.options.manualFlush) {
        this.flushEvents();
      }
    });
    
    window.addEventListener('offline', () => {
      this.connectionStatus = 'offline';
      if (this.options.debug) {
        console.log('[Tracker] Connection lost. Events will be queued.');
      }
    });
  }

  private initBatchProcessing(): void {
    // Try to load queued events from storage
    try {
      const storedEvents = localStorage.getItem('analytics_event_queue');
      if (storedEvents) {
        const parsedEvents = JSON.parse(storedEvents);
        if (Array.isArray(parsedEvents)) {
          this.eventQueue = parsedEvents;
          if (this.options.debug) {
            console.log(`[Tracker] Loaded ${parsedEvents.length} events from storage`);
          }
        }
      }
    } catch (e) {
      if (this.options.debug) {
        console.error('[Tracker] Error loading queued events:', e);
      }
    }
    
    // Set up regular flushing, only if manual flush is not enabled
    if (!this.options.manualFlush) {
      this.flushInterval = setInterval(() => this.flushEvents(), this.options.flushInterval);
    }
    
    // Flush on page unload, even with manual flush enabled
    window.addEventListener('beforeunload', () => this.flushEvents(true));
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

  private trackPerformance(): void {
    if (typeof window === 'undefined' || !window.performance || !window.performance.timing) return;
    
    window.addEventListener('load', () => {
      // Wait for all resources to load
      setTimeout(() => {
        const timing = performance.timing;
        const performanceData = {
          dns: timing.domainLookupEnd - timing.domainLookupStart,
          connect: timing.connectEnd - timing.connectStart,
          ttfb: timing.responseStart - timing.requestStart,
          domLoad: timing.domContentLoadedEventEnd - timing.navigationStart,
          windowLoad: timing.loadEventEnd - timing.navigationStart,
          interactive: timing.domInteractive - timing.navigationStart,
        };
        
        this.trackEvent({
          eventName: 'performance_metrics',
          eventCategory: 'performance',
          properties: performanceData
        });
        
        if (this.options.debug) {
          console.log('[Tracker] Performance metrics tracked:', performanceData);
        }
      }, 0);
    });
  }

  private trackVisibility(): void {
    if (typeof document === 'undefined') return;
    
    let startTime = Date.now();
    let isVisible = !document.hidden;
    
    document.addEventListener('visibilitychange', () => {
      const now = Date.now();
      
      if (document.hidden) {
        // Page is now hidden
        if (isVisible) {
          const visibleTime = now - startTime;
          this.trackEvent({
            eventName: 'visibility_change',
            eventCategory: 'user_engagement',
            eventLabel: 'hidden',
            properties: {
              visible_time_ms: visibleTime,
            }
          });
          isVisible = false;
        }
      } else {
        // Page is now visible
        startTime = now;
        if (!isVisible) {
          this.trackEvent({
            eventName: 'visibility_change',
            eventCategory: 'user_engagement',
            eventLabel: 'visible',
          });
          isVisible = true;
        }
      }
    });
  }

  private trackErrors(): void {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('error', (event) => {
      this.trackEvent({
        eventName: 'js_error',
        eventCategory: 'error',
        eventLabel: event.message,
        properties: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error ? event.error.stack : undefined,
        }
      });
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.trackEvent({
        eventName: 'unhandled_promise_rejection',
        eventCategory: 'error',
        eventLabel: String(event.reason),
        properties: {
          reason: String(event.reason),
          stack: event.reason?.stack,
        }
      });
    });
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
      library_version: '1.1.0', // Library version (updated)
      app_name: 'analytics-pipeline', // App name
      app_type: 'web', // App type
      user_id: this.userId, // User ID
      session_id: this.sessionData.id, // Session ID
      p: window.location.pathname, // Page path
      ref: document.referrer, // Referrer
      domain: window.location.hostname, // Domain
      protocol: window.location.protocol.replace(':', ''), // Protocol
      title: document.title, // Page title
    };
  }

  private queueEvent(event: TrackEventOptions | TrackPageviewOptions, type: 'event' | 'pageview'): void {
    // Skip if we're not sampling this event
    if (!this.shouldSampleEvent()) {
      if (this.options.debug) {
        console.log(`[Tracker] Event sampled out (${this.options.samplingRate}% sampling rate)`, event);
      }
      return;
    }
    
    // Add timestamp to the queued event
    const queueItem: QueuedEvent = { 
      ...event, 
      type,
      timestamp: Date.now()
    };
    
    this.eventQueue.push(queueItem);
    
    // Store in localStorage for offline recovery
    if (this.options.enableOfflineTracking) {
      try {
        localStorage.setItem('analytics_event_queue', JSON.stringify(this.eventQueue));
      } catch (e) {
        if (this.options.debug) {
          console.error('[Tracker] Error storing event queue:', e);
        }
      }
    }
    
    // If queue size exceeds threshold and auto-flush is enabled, flush immediately
    if (!this.options.manualFlush && this.eventQueue.length >= (this.options.batchSize || 10)) {
      this.flushEvents();
    }
    
    if (this.options.debug) {
      console.log(`[Tracker] Event queued (${type}):`, event);
      console.log(`[Tracker] Queue size: ${this.eventQueue.length}`);
    }
  }

  /**
   * Manually flush events from the queue
   */
  public async flushEvents(isUnloading = false): Promise<void> {
    // Don't flush if offline (unless page is unloading)
    if (this.connectionStatus === 'offline' && !isUnloading) {
      if (this.options.debug) {
        console.log('[Tracker] Skip flushing - offline');
      }
      return;
    }
    
    // Don't flush if already sending or queue empty
    if (this.isSending || this.eventQueue.length === 0) return;
    
    this.isSending = true;
    
    // Copy events to send and clear queue
    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];
    
    // Clear stored queue
    if (this.options.enableOfflineTracking) {
      try {
        localStorage.setItem('analytics_event_queue', JSON.stringify([]));
      } catch (e) {
        // Ignore storage errors
      }
    }
    
    try {
      // Send events in batch
      const response = await fetch(this.options.batchEndpoint || '/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: this.options.siteId,
          userId: this.userId,
          sessionId: this.sessionData.id,
          timestamp: Date.now(),
          events: eventsToSend,
          commonParams: this.getCommonParams(),
        }),
        // Using keepalive to ensure request completes even if page unloads
        keepalive: isUnloading,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      if (this.options.debug) {
        console.log(`[Tracker] Successfully flushed ${eventsToSend.length} events`);
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('[Tracker] Error flushing events:', error);
      }
      
      // Put events back in queue if failed (unless unloading)
      if (!isUnloading) {
        this.eventQueue = [...eventsToSend, ...this.eventQueue];
        
        // Store updated queue
        if (this.options.enableOfflineTracking) {
          try {
            localStorage.setItem('analytics_event_queue', JSON.stringify(this.eventQueue));
          } catch (e) {
            // Ignore storage errors
          }
        }
      }
    } finally {
      this.isSending = false;
    }
  }

  /**
   * Set manual flush mode on or off
   */
  public setManualFlush(enabled: boolean): void {
    const wasEnabled = this.options.manualFlush;
    this.options.manualFlush = enabled;
    
    // If we're turning off manual flush, set up the interval
    if (wasEnabled && !enabled) {
      this.flushInterval = setInterval(() => this.flushEvents(), this.options.flushInterval);
      
      // Flush immediately if there are events in the queue
      if (this.eventQueue.length > 0) {
        this.flushEvents();
      }
    }
    
    // If we're turning on manual flush, clear the interval
    if (!wasEnabled && enabled && this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    if (this.options.debug) {
      console.log(`[Tracker] Manual flush ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  // Track a pageview
  public trackPageview(options?: TrackPageviewOptions): void {
    if (typeof window === 'undefined') return;

    const currentPath = options?.path || window.location.pathname;
    const referrer = options?.referrer || document.referrer;
    const language = options?.language || navigator.language;
    const contentType = options?.contentType || 'page';
    const title = options?.title || document.title;
    const isVirtual = options?.virtualPageview || false;

    // Update session data
    this.sessionData.pageviews += 1;
    this.updateSession();

    const pageviewData = {
      path: currentPath,
      referrer,
      language,
      contentType,
      title,
      virtualPageview: isVirtual,
    };

    // Add to queue
    this.queueEvent(pageviewData, 'pageview');
  }

  /**
   * Track a custom event
   */
  public trackEvent(options: TrackEventOptions): void {
    if (typeof window === 'undefined') return;

    // Update session data
    this.sessionData.events += 1;
    this.updateSession();

    // Add to queue
    this.queueEvent(options, 'event');
  }

  /**
   * Track user engagement metrics (scroll depth, time spent, etc.)
   */
  public trackEngagement(): void {
    if (typeof window === 'undefined') return;
    
    let maxScroll = 0;
    const startTime = Date.now();
    
    // Track scroll depth
    window.addEventListener('scroll', () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight) {
        const scrolled = Math.round((window.scrollY / scrollHeight) * 100);
        if (scrolled > maxScroll) {
          maxScroll = scrolled;
          
          // Track scroll milestones (25%, 50%, 75%, 90%)
          if ([25, 50, 75, 90].includes(maxScroll)) {
            this.trackEvent({
              eventName: 'scroll_milestone',
              eventCategory: 'engagement',
              eventLabel: `${maxScroll}%`,
              eventValue: maxScroll
            });
          }
        }
      }
    }, { passive: true });
    
    // Track time spent on page when leaving
    window.addEventListener('beforeunload', () => {
      const timeSpentSeconds = Math.round((Date.now() - startTime) / 1000);
      
      this.trackEvent({
        eventName: 'time_spent',
        eventCategory: 'engagement',
        eventValue: timeSpentSeconds,
        properties: {
          seconds: timeSpentSeconds,
          maxScrollPercentage: maxScroll
        }
      });
    });
  }

  /**
   * Track clicks on specified elements
   */
  public trackClicks(selector: string, options?: {
    category?: string;
    label?: string;
    valueAttribute?: string;
    collectAttributes?: string[];
  }): void {
    if (typeof document === 'undefined') return;
    
    document.addEventListener('click', (event) => {
      const target = event.target as Element;
      const clickedElement = target.closest(selector);
      
      if (clickedElement) {
        const category = options?.category || 'click';
        const label = options?.label || clickedElement.getAttribute('data-track-label') || selector;
        
        // Get value from attribute if specified
        let value: number | undefined;
        if (options?.valueAttribute) {
          const valueStr = clickedElement.getAttribute(options.valueAttribute);
          if (valueStr) {
            value = Number.parseInt(valueStr, 10) || undefined;
          }
        }
        
        // Collect additional attributes if specified
        const properties: Record<string, unknown> = {};
        
        if (options?.collectAttributes) {
          for (const attr of options.collectAttributes) {
            const attrValue = clickedElement.getAttribute(attr);
            if (attrValue) {
              properties[attr] = attrValue;
            }
          }
        }
        
        // Add element text as property
        if (clickedElement.textContent) {
          properties.elementText = clickedElement.textContent.trim().substring(0, 100);
        }
        
        // Track the click event
        this.trackEvent({
          eventName: 'element_click',
          eventCategory: category,
          eventLabel: label,
          eventValue: value,
          properties
        });
      }
    }, { passive: true });
  }

  /**
   * Get current queue status for monitoring
   */
  public getQueueStatus(): QueueStatus {
    return {
      queueLength: this.eventQueue.length,
      events: [...this.eventQueue],
      connectionStatus: this.connectionStatus,
      manualFlush: this.options.manualFlush || false
    };
  }

  /**
   * Clean up event listeners and intervals
   */
  public cleanup(): void {
    // Flush any remaining events
    this.flushEvents(true);
    
    // Clear intervals
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
      this.sessionInterval = null;
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

// Track user engagement
export function trackEngagement(): void {
  if (!tracker) {
    throw new Error('You must call init() before tracking engagement');
  }
  tracker.trackEngagement();
}

// Track clicks on elements
export function trackClicks(selector: string, options?: {
  category?: string;
  label?: string;
  valueAttribute?: string;
  collectAttributes?: string[];
}): void {
  if (!tracker) {
    throw new Error('You must call init() before tracking clicks');
  }
  tracker.trackClicks(selector, options);
}

// Get queue status for monitoring
export function getQueueStatus(): QueueStatus {
  if (!tracker) {
    return { queueLength: 0, events: [], connectionStatus: 'online', manualFlush: false };
  }
  return tracker.getQueueStatus();
}

// Manually flush events
export function flushEvents(): Promise<void> {
  if (!tracker) {
    throw new Error('You must call init() before flushing events');
  }
  return tracker.flushEvents();
}

// Set manual flush mode
export function setManualFlush(enabled: boolean): void {
  if (!tracker) {
    throw new Error('You must call init() before setting manual flush mode');
  }
  tracker.setManualFlush(enabled);
}

// Cleanup tracker
export function cleanup(): void {
  if (tracker) {
    tracker.cleanup();
    tracker = undefined;
  }
}

// Export default functions
export default {
  init,
  trackPageview,
  trackEvent,
  trackEngagement,
  trackClicks,
  getQueueStatus,
  flushEvents,
  setManualFlush,
  cleanup,
};