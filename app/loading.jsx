import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, ActivityIndicator, StyleSheet } from 'react-native';

export default function LoadingScreen() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={styles.fond}>
      <Animated.Image
        source={require('../assets/logo_bovi_sense_clair.png')}
        style={[styles.logo, { transform: [{ scale: pulse }] }]}
        resizeMode="contain"
      />
      <Text style={styles.titre}>BOVISENSE</Text>
      <Text style={styles.sousTitre}>La santé de votre troupeau, dans votre poche.</Text>
      <ActivityIndicator size="large" color="#2D5016" style={styles.indicateur} />
    </View>
  );
}

const styles = StyleSheet.create({
  fond: {
    flex:            1,
    backgroundColor: '#FFFFFF',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 32,
  },
  logo: {
    width:        120,
    height:       120,
    marginBottom: 24,
  },
  titre: {
    fontSize:     28,
    fontWeight:   'bold',
    color:        '#2D5016',
    letterSpacing: 4,
    marginBottom: 10,
  },
  sousTitre: {
    fontSize:   14,
    color:      '#888888',
    textAlign:  'center',
    lineHeight: 20,
  },
  indicateur: {
    marginTop: 40,
  },
});
