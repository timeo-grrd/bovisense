export const normaliserEtat = (etat) => {
  if (!etat) return 'Saine';
  const e = etat.trim();
  if (e === 'Normale' || e === 'Normal' || e === 'normale') return 'Saine';
  if (e === 'En chaleur' || e === 'Chaleurs' || e === 'chaleur') return 'En chaleur';
  if (e === 'Boiterie légère' || e === 'boiterie_legere' || e === 'Boiterie légere') return 'Boiterie_Legere';
  if (e === 'Boiterie sévère' || e === 'boiterie_severe' || e === 'Boiterie severe') return 'Boiterie_Severe';
  if (e === 'Chute' || e === 'chute') return 'Chute';
  if (e === 'Boiterie_Legere') return 'Boiterie_Legere';
  if (e === 'Boiterie_Severe') return 'Boiterie_Severe';
  return e;
};

export const getCouleurEtat = (etat) => {
  const e = normaliserEtat(etat);
  if (e === 'Saine') return '#2D5016';
  if (e === 'Boiterie_Legere') return '#F4A261';
  if (e === 'Boiterie_Severe') return '#E67E22';
  if (e === 'En chaleur') return '#E9C46A';
  if (e === 'Chute') return '#C0392B';
  return '#999999';
};

export const getLabelEtat = (etat) => {
  const e = normaliserEtat(etat);
  if (e === 'Saine') return 'Saine';
  if (e === 'Boiterie_Legere') return 'Boiterie légère';
  if (e === 'Boiterie_Severe') return 'Boiterie sévère';
  if (e === 'En chaleur') return 'En chaleur';
  if (e === 'Chute') return 'Urgence / Chute';
  return e;
};
