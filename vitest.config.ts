import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // DMG staging contains a symlink to /Applications, outside this project.
    include: ["src/**/*.test.{ts,tsx}"]
  }
});
