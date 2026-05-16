import { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COULEURS } from '../../constants/couleurs';
import { supabase } from '../../lib/supabase';

export default function AppLayout() {
  const [nbAlertes, setNbAlertes] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const depuis24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const { count } = await supabase
          .from('historique_sante')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('confirme', false)
          .neq('etat_sante', 'Saine')
          .neq('etat_sante', 'Normale')
          .neq('etat_sante', 'Fausse_alerte')
          .gte('date_diagnostic', depuis24h);
        setNbAlertes(count ?? 0);
      } catch {
        // Non critique — badge reste à 0
      }
    })();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: COULEURS.SEPARATEUR,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveBackgroundColor: COULEURS.VERT_PRINCIPAL,
        tabBarInactiveBackgroundColor: '#FFFFFF',
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#888888',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          flex: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Carte',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="historique"
        options={{
          title: 'Historique',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
          tabBarBadge: nbAlertes > 0 ? nbAlertes : undefined,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Paramètres',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
