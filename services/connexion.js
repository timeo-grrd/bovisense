import NetInfo from '@react-native-community/netinfo';
import { useState, useEffect, useRef } from 'react';

export function useConnexion() {
  const [estConnecte, setEstConnecte] = useState(true);
  const estConnectePrecedentRef = useRef(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connecte = state.isConnected && state.isInternetReachable !== false;
      setEstConnecte(connecte);
    });

    NetInfo.fetch().then((state) => {
      const connecte = state.isConnected && state.isInternetReachable !== false;
      setEstConnecte(connecte);
    });

    return () => unsubscribe();
  }, []);

  return { estConnecte, estConnectePrecedentRef };
}
