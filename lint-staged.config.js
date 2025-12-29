import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const getPackageNameFromDir = dir => {
  const packageJsonPath = join(dir, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const content = readFileSync(packageJsonPath, 'utf-8');
      return JSON.parse(content).name;
    } catch (e) {
      console.error(`Error reading package.json in ${dir}:`, e);
      return null;
    }
  }
  return null;
};

const findPackageName = filePath => {
  let currentDir = dirname(filePath);

  while (currentDir !== '.' && currentDir !== '\\') {
    const name = getPackageNameFromDir(currentDir);
    if (name) return name;
    currentDir = dirname(currentDir);
  }
  return null;
};

const lintStagedConfig = {
  '*.{ts,tsx,vue,js,jsx}': files => {
    const packages = new Set();

    files.forEach(file => {
      const packageName = findPackageName(file);
      if (packageName) {
        packages.add(packageName);
      }
    });

    const commands = [];
    if (packages.size > 0) {
      const filterArgs = Array.from(packages)
        .map(pkg => `--filter ${pkg}`)
        .join(' ');
      commands.push(`pnpm ${filterArgs} lint:fix`);
      commands.push(`pnpm ${filterArgs} format`);
    }

    return commands;
  },
  '**/*.json': ['pnpm run format'],
};

export default lintStagedConfig;
