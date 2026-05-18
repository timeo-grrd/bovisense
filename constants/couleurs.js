// Charte graphique BoviSense — thème clair nature/agricole
export const COULEURS = {
  FOND_PRINCIPAL:   '#F5F0E8',
  FOND_CARD:        '#FFFFFF',
  FOND_INPUT:       '#FFFFFF',
  VERT_PRINCIPAL:   '#2D5016',
  VERT_BOUTON:      '#3D6B1F',
  VERT_CLAIR:       '#3D6B1F',
  ROUGE_URGENCE:    '#C0392B',
  ORANGE_ALERTE:    '#E67E22',
  JAUNE_CHALEURS:   '#F39C12',
  TEXTE_PRINCIPAL:  '#1A1A1A',
  TEXTE_SECONDAIRE: '#666666',
  SEPARATEUR:       '#DDDDDD',
  BLANC_LEGER:      '#F5F0E8',
};

export function couleurEtat(etat) {
  switch (etat) {
    case 'Chute':            return '#C0392B';
    case 'Boiterie_Severe':  return '#E67E22';
    case 'Boiterie_Legere':  return '#F4A261';
    case 'En chaleur':       return '#E9C46A';
    case 'Chaleurs':         return '#E9C46A';
    case 'Saine':            return '#2D5016';
    default:                 return '#999999';
  }
}

export function libelleEtat(etat) {
  switch (etat) {
    case 'Chute':            return 'Urgence — Chute';
    case 'Boiterie_Severe':  return 'Boiterie sévère';
    case 'Boiterie_Legere':  return 'Boiterie légère';
    case 'En chaleur':       return 'En chaleur';
    case 'Chaleurs':         return 'En chaleur';
    case 'Saine':            return 'Saine';
    default:                 return etat || 'Inconnu';
  }
}
