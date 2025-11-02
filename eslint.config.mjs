import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // CSS inline styles kuralını devre dışı bırak - Progress bar gibi dinamik UI için gerekli
      "@next/next/no-html-link-for-pages": "off",
      "react/jsx-no-inline-styles": "off",
    },
  },
]);

export default eslintConfig;
