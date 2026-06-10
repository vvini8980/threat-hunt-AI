import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';

const ClientContext = createContext();

export const useClient = () => useContext(ClientContext);

export const ClientProvider = ({ children }) => {
  const [selectedClient, setSelectedClient] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchClients();
    } else {
      setClients([]);
      setSelectedClient(null);
      setLoading(false);
    }
  }, [user]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      const updatedClients = data || [];
      setClients(updatedClients);
      
      if (updatedClients.length > 0) {
        if (!selectedClient) {
          setSelectedClient(updatedClients[0]);
        } else {
          const fresh = updatedClients.find(c => c.id === selectedClient.id);
          if (fresh) {
            setSelectedClient(fresh);
          } else {
            setSelectedClient(updatedClients[0]);
          }
        }
      } else {
        setSelectedClient(null);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    selectedClient,
    setSelectedClient,
    clients,
    loading,
    refreshClients: fetchClients
  };

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
};
