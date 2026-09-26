const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// EMFILE hatasını önlemek için gereksiz dizin izlemelerini engelle
config.resolver.blacklistRE = /node_modules\/.*\/node_modules/;
config.watcher.additionalModuleFolders = [];

module.exports = config;
