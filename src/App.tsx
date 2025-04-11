import { useState, useEffect } from 'react';

function App() {
  const [formData, setFormData] = useState({
    s: 'test', // Site ID
    ts: Date.now().toString(), // Timestamp
    vtag: '1.0.0', // Version tag
    r: getScreenDimensions(), // Screen dimensions
    re: getViewportDimensions(), // Viewport dimensions
    lng: 'en-GB', // Language
    content_type: 'index-home', // Content type
    library_version: '1.0.0', // Library version
    app_name: 'test-app', // App name
    app_type: 'responsive', // App type
    user_id: generateUUID(), // User ID
  });

  const [apiResponse, setApiResponse] = useState<{
    error?: string;
  } | null>(null);
  const [queryString, setQueryString] = useState('');
  const [collecting, setCollecting] = useState(false);

  // Generate a query string from the form data
  useEffect(() => {
    const qs = Object.entries(formData)
      .filter(([key, value]) => value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    setQueryString(qs);
  }, [formData]);

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getScreenDimensions() {
    return `${window.screen.width}x${window.screen.height}x${window.screenX}x${window.screenY}`;
  }

  function getViewportDimensions() {
    return `${window.innerWidth}x${window.innerHeight}`;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const refreshDynamicValues = () => {
    setFormData(prev => ({
      ...prev,
      ts: Date.now().toString(),
      r: getScreenDimensions(),
      re: getViewportDimensions(),
    }));
  };

  const handleCollectData = async () => {
    try {
      setCollecting(true);
      const response = await fetch(`/collect?${queryString}`);
      const data = await response.json();
      setApiResponse(data);
      console.log('Data collected:', data);
    } catch (error) {
      console.error('Error collecting data:', error);
      setApiResponse({ error: 'Failed to collect data' });
    } finally {
      setCollecting(false);
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
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Analytics Parameters</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(formData).map(([key, value]) => (
              <div key={key} className="mb-4">
                <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1">
                  {key}
                </label>
                <input
                  type="text"
                  id={key}
                  name={key}
                  value={value}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            ))}
          </div>
          
          <div className="mt-4 flex space-x-4">
            <button
              type="button"
              onClick={refreshDynamicValues}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition duration-300 ease-in-out"
            >
              Refresh Dynamic Values
            </button>
            <button
              type="button"
              onClick={handleCollectData}
              disabled={collecting}
              className="px-5 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition duration-300 ease-in-out disabled:opacity-50"
            >
              {collecting ? 'Collecting...' : 'Collect Data (JSON)'}
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Query String</h2>
          <div className="bg-gray-100 p-4 rounded overflow-auto whitespace-pre-wrap break-all mb-6 text-sm">
            {queryString}
          </div>
          
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