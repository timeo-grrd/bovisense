import { useEffect, useState } from 'react';
import { router, Slot } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import LoadingScreen from './loading';
import { enregistrerNotifications } from '../services/notifications';

export default function RootLayout() {
  const [appPrete, setAppPrete] = useState(false);
  const [navigation, setNavigation] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      naviguer();
    }, 3000);

    const naviguer = async () => {
      clearTimeout(timer);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setNavigation(session ? '/(app)' : '/(auth)/login');
      } catch {
        try {
          const keys = await AsyncStorage.getAllKeys();
          const aSession = keys.some(k =>
            k.toLowerCase().includes('supabase') ||
            k.toLowerCase().includes('auth')
          );
          setNavigation(aSession ? '/(app)' : '/(auth)/login');
        } catch {
          setNavigation('/(auth)/login');
        }
      } finally {
        setAppPrete(true);
      }
    };

    const splashTimer = setTimeout(naviguer, 1500);

    enregistrerNotifications().catch(() => {});

    return () => {
      clearTimeout(timer);
      clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => {
    if (appPrete && navigation) {
      router.replace(navigation);
    }
  }, [appPrete, navigation]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!appPrete) return;
      if (event === 'SIGNED_OUT') { router.replace('/(auth)/login'); }
      else if (event === 'SIGNED_IN' && session) { router.replace('/(app)'); }
    });
    return () => subscription.unsubscribe();
  }, [appPrete]);

  if (!appPrete) return <LoadingScreen />;
  return <Slot />;
}
