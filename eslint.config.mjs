import { dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "node:module";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  // Resolve Next's transitive plugins without relying on pnpm hoisting.
  resolvePluginsRelativeTo: dirname(require.resolve("eslint-config-next")),
});

const eslintConfig = [
  { ignores: ["node_modules/**", ".next/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
