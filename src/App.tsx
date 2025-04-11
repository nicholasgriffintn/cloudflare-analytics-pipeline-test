function App() {
  const handleCollectData = async () => {
    try {
      const response = await fetch('/collect');
      const data = await response.json();
      console.log('Data collected:', data);
    } catch (error) {
      console.error('Error collecting data:', error);
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
        <div className="bg-white p-8 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Dashboard</h2>
          <p className="text-gray-600 mb-4">
            Click the button below to trigger a data collection event.
          </p>
          <button
            type="button"
            onClick={handleCollectData}
            className="px-5 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition duration-300 ease-in-out"
          >
            Collect Data
          </button>
          {/* Placeholder for more interactive elements */}
          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-medium text-gray-700 mb-3">More Actions</h3>
            <p className="text-sm text-gray-500">Coming soon.</p>
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