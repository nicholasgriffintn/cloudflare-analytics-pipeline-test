import { useState, useEffect } from 'react';
import { init as initTracker, trackPageview, trackEvent } from './lib/tracker';

function App() {
  const [apiResponse, setApiResponse] = useState<{
    message?: string;
    error?: string;
  } | null>(null);
  const [trackerInitialized, setTrackerInitialized] = useState(false);

  // Initialize tracker
  useEffect(() => {
    try {
      initTracker({
        siteId: 'test',
        autoTrack: true,
        debug: true,
      });
      setTrackerInitialized(true);
      setApiResponse({ message: 'Tracker initialized with automatic page view tracking' });
    } catch (error) {
      console.error('Failed to initialize tracker:', error);
    }
  }, []);

  const handleTrackPageview = () => {
    if (trackerInitialized) {
      trackPageview({
        contentType: 'manual-track',
        language: 'en-GB',
      });
      setApiResponse({ message: 'Manual pageview tracked using the tracker library' });
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
    } else {
      setApiResponse({ error: 'Tracker not initialized' });
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
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Analytics Tracker</h2>
          
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              The page view was automatically tracked when this page loaded.
              You can also manually track page views or custom events.
            </p>
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleTrackPageview}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition duration-300"
              >
                Track Manual Page View
              </button>
              
              <button
                type="button"
                onClick={handleTrackEvent}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition duration-300"
              >
                Track Button Click Event
              </button>

              <button
                type="button"
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
              <span className={`inline-block px-2 py-1 rounded text-sm mr-2 ${trackerInitialized ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {trackerInitialized ? 'Initialized' : 'Not Initialized'}
              </span>
              <span className="text-gray-600">
                Site ID: test
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">API Response</h2>
          <div className="bg-gray-100 p-4 rounded overflow-auto h-64 whitespace-pre-wrap text-sm">
            {apiResponse ? JSON.stringify(apiResponse, null, 2) : 'No data collected yet.'}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-200 text-gray-600 p-4 text-center text-sm">
        <a
          href="https://github.com/nicholasgriffintn/cloudflare-analytics-pipeline-test"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-gray-800 underline"
        >
          View the code on GitHub
        </a>
      </footer>
    </div>
  );
}

export default App;