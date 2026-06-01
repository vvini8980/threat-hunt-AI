export const analyzeThreat = async (query) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(`Dummy Gemini Analysis for: ${query}`);
    }, 1000);
  });
};
