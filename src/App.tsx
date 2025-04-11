import { useState, useEffect, useCallback } from 'react';
import { 
  init as initTracker, 
  trackPageview, 
  trackEvent, 
  trackEngagement, 
  trackClicks, 
  getQueueStatus,
  flushEvents,
  setManualFlush
} from './lib/tracker';

function App() {
  const [apiResponse, setApiResponse] = useState<{
    message?: string;
    error?: string;
  } | null>(null);
  const [trackerInitialized, setTrackerInitialized] = useState(false);
  const [queueStatus, setQueueStatus] = useState<{
    queueLength: number;
    events: Array<{
      type: 'event' | 'pageview';
      eventName?: string;
      eventCategory?: string;
      eventLabel?: string;
      path?: string;
      timestamp?: number;
      [key: string]: unknown;
    }>;
    connectionStatus: 'online' | 'offline';
    manualFlush: boolean;
  }>({ queueLength: 0, events: [], connectionStatus: 'online', manualFlush: false });

  // Function to update queue status
  const updateQueueStatus = useCallback(() => {
    if (trackerInitialized) {
      const status = getQueueStatus();
      setQueueStatus(status);
    }
  }, [trackerInitialized]);

  // Initialize tracker with enhanced options
  useEffect(() => {
    try {
      initTracker({
        siteId: 'test',
        batchEndpoint: '/batch',
        eventEndpoint: '/event',
        autoTrack: true,
        debug: true,
        batchSize: 5,
        flushInterval: 15000,
        enableOfflineTracking: true,
        sessionTimeout: 30,
        samplingRate: 100,
        manualFlush: true, // Enable manual flush by default to show queuing behavior
      });
      
      // Initialize click tracking on buttons
      trackClicks('button', {
        category: 'button_interaction',
        collectAttributes: ['type', 'data-id']
      });
      
      // Initialize user engagement tracking
      trackEngagement();
      
      setTrackerInitialized(true);
      setApiResponse({ message: 'Tracker initialized with manual flush mode enabled' });
      
      // Update queue status initially
      setTimeout(updateQueueStatus, 500);
      
      // Set up interval to update queue status
      const intervalId = setInterval(updateQueueStatus, 1000); // Reduced to 1 second for more frequent updates
      return () => clearInterval(intervalId);
    } catch (error) {
      console.error('Failed to initialize tracker:', error);
      setApiResponse({ error: `Failed to initialize: ${error}` });
    }
  }, [updateQueueStatus]);

  const handleTrackPageview = () => {
    if (trackerInitialized) {
      trackPageview({
        contentType: 'manual-track',
        language: 'en-GB',
        virtualPageview: true,
        title: 'Virtual Page View Test',
        path: '/virtual-page'
      });
      setApiResponse({ message: 'Manual virtual pageview tracked using the tracker library' });
      // Update immediately after adding to queue
      setTimeout(updateQueueStatus, 10);
    } else {
      setApiResponse({ error: 'Tracker not initialized' });
    }
  };

  const handleTrackEvent = () => {
    if (trackerInitialized) {
      trackEvent({
        eventName: 'button_click',
        eventCategory: 'ui_interaction',
        eventLabel: 'track_event_button',
        eventValue: 1,
        nonInteraction: false,
        properties: {
          buttonId: 'track-event-btn',
          timestamp: Date.now(),
          currentPath: window.location.pathname,
          sessionData: {
            referrer: document.referrer,
            language: navigator.language,
          }
        }
      });
      setApiResponse({ message: 'Event tracked with detailed properties' });
      // Update immediately after adding to queue
      setTimeout(updateQueueStatus, 10);
    } else {
      setApiResponse({ error: 'Tracker not initialized' });
    }
  };

  const handleTrackCustomEvent = () => {
    if (trackerInitialized) {
      trackEvent({
        eventName: 'form_submission',
        eventCategory: 'conversion',
        eventLabel: 'demo_form',
        nonInteraction: false,
        properties: {
          formId: 'demo-form',
          fields: ['name', 'email', 'message'],
          formCompleted: true,
          submissionTime: new Date().toISOString(),
          userPreferences: {
            marketingConsent: true,
            theme: 'light',
          }
        }
      });
      setApiResponse({ message: 'Custom form submission event tracked with nested properties' });
      // Update immediately after adding to queue
      setTimeout(updateQueueStatus, 10);
    } else {
      setApiResponse({ error: 'Tracker not initialized' });
    }
  };

  const handleToggleFlushMode = () => {
    if (trackerInitialized) {
      const newMode = !queueStatus.manualFlush;
      setManualFlush(newMode);
      setApiResponse({ 
        message: `${newMode ? 'Manual' : 'Automatic'} flush mode enabled` 
      });
      // Update status immediately
      setTimeout(updateQueueStatus, 10);
    }
  };

  const handleFlushEvents = () => {
    if (trackerInitialized) {
      flushEvents().then(() => {
        setApiResponse({ message: 'Events flushed successfully' });
        setTimeout(updateQueueStatus, 10);
      }).catch(error => {
        setApiResponse({ error: `Failed to flush events: ${error}` });
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white p-4 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-xl font-semibold">Analytics Test App</h1>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-6">
        <div className="bg-white p-8 rounded-lg shadow mb-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Enhanced Analytics Tracker</h2>
          
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              The page view was automatically tracked when this page loaded.
              User engagement metrics and button clicks are also being tracked automatically.
            </p>
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-id="pageview-btn"
                onClick={handleTrackPageview}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition duration-300"
              >
                Track Virtual Page View
              </button>
              
              <button
                type="button"
                data-id="click-event-btn"
                onClick={handleTrackEvent}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition duration-300"
              >
                Track Button Click Event
              </button>

              <button
                type="button"
                data-id="form-event-btn"
                onClick={handleTrackCustomEvent}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition duration-300"
              >
                Track Form Submission
              </button>
            </div>
          </div>
          
          <div className="mt-8">
            <h3 className="text-xl font-bold mb-2 text-gray-800">Tracker Status</h3>
            <div className="bg-gray-100 p-3 rounded">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`inline-block px-2 py-1 rounded text-sm ${trackerInitialized ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {trackerInitialized ? 'Initialized' : 'Not Initialized'}
                </span>
                <span className={`inline-block px-2 py-1 rounded text-sm ${queueStatus.connectionStatus === 'online' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {queueStatus.connectionStatus.toUpperCase()}
                </span>
                <span className={`inline-block px-2 py-1 rounded text-sm ${queueStatus.manualFlush ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                  {queueStatus.manualFlush ? 'MANUAL FLUSH' : 'AUTO FLUSH'}
                </span>
              </div>
              <div className="text-gray-600">
                Site ID: test | Batch Size: 5 | Offline Support: Enabled
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-gray-800">Event Queue</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleToggleFlushMode}
                  className={`px-3 py-1 text-sm rounded ${queueStatus.manualFlush ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-500 hover:bg-blue-600'} text-white transition duration-300`}
                >
                  {queueStatus.manualFlush ? 'Enable Auto-Flush' : 'Enable Manual Flush'}
                </button>
                <button
                  type="button"
                  onClick={handleFlushEvents}
                  disabled={queueStatus.queueLength === 0}
                  className={`px-3 py-1 text-sm rounded ${queueStatus.queueLength === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'} text-white transition duration-300`}
                >
                  Flush Now ({queueStatus.queueLength})
                </button>
              </div>
            </div>
            <div className="bg-gray-100 p-3 rounded">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Queue Length: {queueStatus.queueLength}</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {queueStatus.manualFlush 
                    ? 'Events will only be sent when manually flushed' 
                    : 'Events will flush when queue reaches 5 items or after 15 seconds'}
                </span>
              </div>
              
              {queueStatus.queueLength > 0 ? (
                <div className="max-h-40 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="p-2 text-left">Type</th>
                        <th className="p-2 text-left">Event Name</th>
                        <th className="p-2 text-left">Category</th>
                        <th className="p-2 text-left">Time</th>
                        <th className="p-2 text-left">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queueStatus.events.map((event, index) => {
                        const eventTime = event.timestamp 
                          ? new Date(event.timestamp).toLocaleTimeString()
                          : new Date().toLocaleTimeString();
                          
                        return (
                          <tr key={`${event.type}-${index}-${event.timestamp}`} className="border-b border-gray-200">
                            <td className="p-2">{event.type}</td>
                            <td className="p-2">{event.type === 'pageview' ? 'pageview' : event.eventName}</td>
                            <td className="p-2">{event.type === 'pageview' ? 'page' : event.eventCategory}</td>
                            <td className="p-2">{eventTime}</td>
                            <td className="p-2 text-xs">
                              {event.type === 'pageview' 
                                ? `Path: ${event.path || '/'}` 
                                : `Label: ${event.eventLabel || 'none'}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600 italic">Queue is empty - all events have been sent</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">API Response</h2>
          <div className="bg-gray-100 p-4 rounded overflow-auto h-64 whitespace-pre-wrap text-sm">
            {apiResponse ? JSON.stringify(apiResponse, null, 2) : 'No data collected yet.'}
          </div>
          <p className="mt-4 text-sm text-gray-600">
            {queueStatus.manualFlush 
              ? 'Manual flush mode is enabled - events will remain in the queue until you click "Flush Now".'
              : 'Events are batched and will be sent either when the batch size reaches 5 events or after 15 seconds.'}
            <br />
            All events are stored locally when offline and sent when connection is restored.
          </p>
        </div>
      </main>

      <footer className="bg-gray-200 text-gray-600 p-4 text-center text-sm">
        <p>
          Analytics data is being collected and processed with the enhanced analytics pipeline.
          <br />
          <a
            href="https://github.com/nicholasgriffintn/cloudflare-analytics-pipeline-test"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-800 underline"
          >
            View the code on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;