import { useState, useCallback } from 'react';
import { extractIOCs } from '../services/ioc';

export const useIOCs = () => {
  const [iocs, setIocs] = useState([]);
  const [loading, setLoading] = useState(false);

  const parseTextForIOCs = useCallback(async (text) => {
    setLoading(true);
    try {
      const results = await extractIOCs(text);
      setIocs(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addIOC = (ioc) => setIocs(prev => [...prev, ioc]);
  
  const removeIOC = (index) => {
    setIocs(prev => prev.filter((_, i) => i !== index));
  };

  return { iocs, loading, parseTextForIOCs, addIOC, removeIOC };
};
