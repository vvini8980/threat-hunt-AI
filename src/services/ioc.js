export const extractIOCs = async (text) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve([
        { type: 'IP', value: '192.168.1.100', context: 'C2 Server' },
        { type: 'Domain', value: 'malicious-domain.com', context: 'Phishing link' },
        { type: 'Hash', value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', context: 'Malware Payload' }
      ]);
    }, 500);
  });
};
