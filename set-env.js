const fs = require('fs');

const targetPath = './src/app/environment/environment.ts';

const envConfigFile = `
export const URL_API = '${process.env.URL_API || ''}';
export const CITIES_API = '${process.env.CITIES_API || ''}';
`;

fs.mkdirSync('./src/app/environment', { recursive: true });

fs.writeFileSync(targetPath, envConfigFile);
