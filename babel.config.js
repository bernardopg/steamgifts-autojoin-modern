/**
 * This Babel config is ONLY for Jest tests, not for Parcel builds.
 * Parcel handles its own transpilation.
 */
module.exports = function(api) {
  if (api && api.env) {
    // Only apply this config when running tests
    const isTest = api.env('test');
    
    // Set cache to true for faster builds
    api.cache(true);
    
    // Return different configs based on environment
    if (isTest) {
      return {
        presets: [
          [
            '@babel/preset-env',
            {
              targets: {
                node: 'current',
              },
            },
          ],
        ],
      };
    }
  }
  
  // Return empty config for Parcel to use its own transpilation
  return {};
};