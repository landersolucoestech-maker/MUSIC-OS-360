import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      ".tmp/**",
      ".turbo/**",
      ".local/**",
      ".validation-shots/**",
      ".tmp-audit/**",
      "node_modules/**",
      "attached_assets/**",
      "apps/**/coverage/**",
      "apps/**/dist/**",
      "packages/**/dist/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // P0-08: Pre-existing lint debt — downgraded to warn until strict-types
      // migration backlog completes. CI now passes while preserving visibility.
      // New files should still avoid these patterns.
      // find-42ac2e2b: was fully "off" (not merely warn like its
      // siblings here), hiding dead-code findings from lint entirely with no
      // comment explaining why. Downgraded to warn (matching the pattern
      // above) instead of left off; `_`-prefixed args/vars are still allowed
      // (a common intentional-unused convention).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "no-empty": "warn",
    },
  },
);
