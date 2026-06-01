export const searchThreatFeeds = async (query) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        { source: 'OpenCTI', title: `Report on ${query}`, date: '2026-05-20', url: '#' },
        { source: 'AlienVault', title: `Pulse for ${query}`, date: '2026-05-22', url: '#' }
      ]);
    }, 800);
  });
};
