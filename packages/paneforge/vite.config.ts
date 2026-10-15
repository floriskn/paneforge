import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [sveltekit()],
	// Component tests mount into jsdom, so Svelte has to resolve to its client build
	// rather than the server one.
	resolve: process.env.VITEST ? { conditions: ["browser"] } : undefined,
	test: {
		include: ["src/**/*.{test,spec}.{js,ts}"],
		// Tests that mount components need a DOM.
		environmentMatchGlobs: [["src/tests/**", "jsdom"]],
	},
});
