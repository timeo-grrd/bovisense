import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';

const MESSAGES = ['Connexion...', 'Chargement du troupeau...', 'Prêt !'];

export default function LoadingScreen() {
  const pulse = useRef(new Animated.Value(1)).current;
  const dot1  = useRef(new Animated.Value(0)).current;
  const dot2  = useRef(new Animated.Value(0)).current;
  const dot3  = useRef(new Animated.Value(0)).current;
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 300, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.95, duration: 300, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(dot1, { toValue: 0, duration: 100, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0, duration: 100, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0, duration: 100, useNativeDriver: true }),
        ]),
      ])
    ).start();

    const t1 = setTimeout(() => setMsgIdx(1), 800);
    const t2 = setTimeout(() => setMsgIdx(2), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [pulse, dot1, dot2, dot3]);

  return (
    <View style={styles.fond}>
      <Animated.Image
        source={require('../assets/logo_bovi_sense_clair.png')}
        style={[styles.logo, { transform: [{ scale: pulse }] }]}
        resizeMode="contain"
      />
      <Text style={styles.titre}>BOVISENSE</Text>
      <Text style={styles.sousTitre}>La santé de votre troupeau, dans votre poche.</Text>
      <Text style={styles.message}>{MESSAGES[msgIdx]}</Text>
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { opacity: dot3 }]} />
      </View>
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
    marginBottom: 24,
  },
  message: {
    fontSize:   14,
    color:      '#2D5016',
    fontWeight: '600',
    marginBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width:        10,
    height:       10,
    borderRadius: 5,
    backgroundColor: '#2D5016',
  },
});
