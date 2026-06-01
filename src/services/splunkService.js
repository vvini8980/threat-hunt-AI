export const createSearchJob = async (url, token, query) => {
  if (!url || !token) throw new Error("Splunk URL and API Token are required.");

  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  
  // Splunk search REST API requires queries to start with "search " or "|"
  const formattedQuery = query.trim().startsWith('search ') || query.trim().startsWith('|') 
    ? query 
    : `search ${query}`;

  const response = await fetch(`${baseUrl}/services/search/jobs?output_mode=json`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ search: formattedQuery })
  });

  if (!response.ok) {
    throw new Error(`Splunk API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.sid;
};

export const checkJobStatus = async (url, token, sid) => {
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  
  const response = await fetch(`${baseUrl}/services/search/jobs/${sid}?output_mode=json`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Splunk API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.entry[0].content; // Contains dispatchState, isDone, doneProgress
};

export const getJobResults = async (url, token, sid) => {
  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;

  const response = await fetch(`${baseUrl}/services/search/jobs/${sid}/results?output_mode=json`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Splunk API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results;
};
