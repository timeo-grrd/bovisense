import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function enregistrerNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bovisense', {
      name: 'Alertes BoviSense',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C0392B',
      sound: 'default',
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  console.log('Permission notifications:', status);
  if (status === 'granted') {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ BoviSense actif',
        body: 'Les alertes sont activées',
        sound: 'default',
      },
      trigger: { seconds: 3 },
    });
  }
  return status === 'granted';
}

export async function envoyerNotificationUrgence(nomVache, etat) {
  const configs = {
    'Chute': {
      titre: '🚨 Urgence vitale !',
      corps: `Vache ${nomVache} immobilisée — intervention immédiate requise`,
    },
    'Boiterie_Severe': {
      titre: '⚠️ Boiterie sévère détectée',
      corps: `Vache ${nomVache} — consultation vétérinaire recommandée`,
    },
    'Boiterie_Legere': {
      titre: '⚠️ Boiterie légère détectée',
      corps: `Vache ${nomVache} — à surveiller`,
    },
    'En chaleur': {
      titre: '🔔 Chaleurs détectées',
      corps: `Vache ${nomVache} — période de chaleurs en cours`,
    },
  };

  const config = configs[etat];
  if (!config) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: config.titre,
        body: config.corps,
        sound: 'default',
        data: { nomVache, etat },
        ...(Platform.OS === 'android' && {
          channelId: 'bovisense',
          priority: 'max',
          vibrate: [0, 250, 250, 250],
        }),
      },
      trigger: null,
    });
  } catch (e) {
    console.log('Erreur notification:', e);
  }
}
