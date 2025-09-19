# Joyería PVenta — Electron + React/Vite

## Política de artefactos y binarios

Este repositorio solo versiona el código fuente y la configuración. Los artefactos de build y los instaladores se generan localmente y NO se suben a Git.

- Qué se ignora (ver `.gitignore`):
  - node_modules/, dist/, out/, .vite/, .next/, .parcel-cache/, dist-ssr/, *.local, .DS_Store
  - Electron Builder: /release/, *.dmg, *.exe, *.blockmap, *.snap, *.AppImage, *.asar, *.zip, *.tar.gz, *.pkg, latest*.yml, builder*.yml
  - Logs: npm/yarn/pnpm/debug logs, lerna-debug.log, debug.log
  - IDE/SO: .idea/, .vscode/ (se permite .vscode/extensions.json), *.swp, Thumbs.db
- `.gitattributes`: marcamos instaladores/paquetes como binarios (*.dmg, *.exe, *.asar, *.AppImage, *.snap, *.zip, *.tar.gz, *.pkg) para evitar diffs inútiles.
- Publicación: usa GitHub Releases o un drive externo para compartir instaladores, no Git.

Si se subieron binarios por error (por ejemplo, archivos >100MB), hay que reescribir la historia para eliminarlos antes de poder hacer push:

```bash
# Opción recomendada (git-filter-repo)
brew install git-filter-repo   # si no lo tienes
git branch backup/pre-cleanup
git filter-repo --invert-paths --path release --path-glob '*.dmg' --path-glob '*.exe' --path-glob '*.AppImage' --path-glob '*.asar' --path-glob '*.zip' --path-glob '*.tar.gz' --path-glob '*.pkg' --path-glob '*.blockmap' --force
git push origin main --force-with-lease

# Alternativa (BFG Repo-Cleaner)
# bfg --delete-folders release --delete-files '*.dmg,*.exe,*.AppImage,*.asar,*.zip,*.tar.gz,*.pkg,*.blockmap'
# git push origin main --force-with-lease
```

—

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
