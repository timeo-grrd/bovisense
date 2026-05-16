import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function enregistrerNotifications() {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bovisense', {
      name: 'BoviSense Alertes',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C0392B',
      sound: true,
    });
  }

  return true;
}

export async function envoyerNotificationUrgence(nomVache, etat) {
  const titres = {
    'Chute':            '🚨 Urgence vitale !',
    'Boiterie_Severe':  '⚠️ Boiterie sévère détectée',
    'Boiterie_Legere':  '⚠️ Boiterie légère détectée',
    'Chaleurs':         '🔔 Chaleurs détectées',
  };

  const messages = {
    'Chute':           `Vache ${nomVache} immobilisée — intervention immédiate requise`,
    'Boiterie_Severe': `Vache ${nomVache} — boiterie sévère, consulter rapidement`,
    'Boiterie_Legere': `Vache ${nomVache} — boiterie légère détectée`,
    'Chaleurs':        `Vache ${nomVache} — période de chaleurs en cours`,
  };

  if (!titres[etat]) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title:    titres[etat],
      body:     messages[etat],
      data:     { nomVache, etat },
      sound:    true,
      priority: etat === 'Chute' ? 'max' : 'high',
    },
    trigger: null,
  });
}
