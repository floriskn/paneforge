import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";

// A scratch page for trying things out. It exists in `pnpm dev` only.
export const prerender = false;

export function load() {
	if (!dev) error(404, "Not found");
}
