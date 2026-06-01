export const fetchLatestCampaigns = async (url, token) => {
  if (!url || !token) throw new Error("OpenCTI URL and API Token are required.");

  const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  
  // Example GraphQL query to fetch recent campaigns
  const query = `
    query RecentCampaigns {
      campaigns(first: 10, orderBy: created_at, orderMode: desc) {
        edges {
          node {
            id
            name
            description
            first_seen
            last_seen
          }
        }
      }
    }
  `;

  const response = await fetch(`${baseUrl}/graphql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    throw new Error(`OpenCTI API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data.campaigns.edges.map(edge => edge.node);
};

export const getIOCsForActor = async (url, token, actorId) => {
  // Scaffold for future GraphQL query fetching related Observables/Indicators
  console.log(`Fetching IOCs for actor ${actorId} from ${url}`);
  return []; 
};
