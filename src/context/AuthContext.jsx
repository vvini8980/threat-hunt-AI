import { createContext, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  // Mock user and role since auth is temporarily skipped
  const value = {
    user: { id: 'mock-user-id', email: 'admin@mdr.local' },
    role: 'admin',
    login: async () => ({ error: null }),
    logout: async () => { window.location.href = '/login' },
    loading: false,
    isAdmin: true
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
