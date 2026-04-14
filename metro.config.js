// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude problematic Gradle build artifact directories from Metro's resolver/watcher
// to prevent ENOENT errors on Windows when Metro tries to watch
// dynamically created/deleted build output directories.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : config.resolver.blockList ? [config.resolver.blockList] : []),
  /expo-modules-autolinking[\\/]android[\\/].*[\\/]build[\\/].*/,
];

module.exports = config;
