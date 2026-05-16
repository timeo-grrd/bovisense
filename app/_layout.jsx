import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import LoadingScreen from './loading';
import { enregistrerNotifications } from '../services/notifications';

export default function RootLayout() {
  const [appPrete, setAppPrete]        = useState(false);
  const [chargement, setChargement]    = useState(true);
  const [utilisateur, setUtilisateur]  = useState(null);

  useEffect(() => {
    setTimeout(() => setAppPrete(true), 2500);
    enregistrerNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUtilisateur(session?.user ?? null);
      setChargement(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUtilisateur(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!appPrete || chargement) return;
    if (utilisateur) {
      router.replace('/(app)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [appPrete, chargement, utilisateur]);

  if (!appPrete) return <LoadingScreen />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}
