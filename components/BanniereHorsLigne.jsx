import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BanniereHorsLigne({ visible }) {
  if (!visible) return null;

  return (
    <View style={styles.banniere}>
      <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />
      <Text style={styles.texte}>Mode hors ligne — données en cache</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banniere: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#757575',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  texte: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
