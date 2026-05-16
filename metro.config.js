const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Support pour les fichiers .mjs utilisés par certains packages Supabase
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;
