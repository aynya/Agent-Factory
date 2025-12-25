import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const getPackageJson = filePath => {
  const packageJsonPath = join(filePath, 'package.json');
  if (existsSync(packageJsonPath)) {
    return JSON.parse(execSync(`cat ${packageJsonPath}`));
  }
  return null;
};

const getPackageName = changedFile => {
  const paths = [
    'apps/web/src',
    'apps/server/src',
    'packages/types/src',
    'packages/utils/src',
  ];

  for (const srcPath of paths) {
    if (changedFile.startsWith(srcPath)) {
      const packagePath = srcPath.split('/src')[0];
      const packageJson = getPackageJson(packagePath);
      if (packageJson) {
        return packageJson.name;
      }
    }
  }
  return null;
};

const lintStagedConfig = {
  '*.{ts,tsx,vue,js,jsx}': files => {
    const packages = new Set();

    for (const file of files) {
      const packageName = getPackageName(file);
      if (packageName) {
        packages.add(packageName);
      }
    }

    const commands = [];
    for (const pkg of packages) {
      commands.push(`pnpm --filter ${pkg} lint:fix`);
      commands.push(`pnpm --filter ${pkg} format`);
    }

    return commands;
  },
  '**/*.json': ['pnpm run format'],
};

export default lintStagedConfig;
