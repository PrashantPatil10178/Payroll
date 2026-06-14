"use client";

/**
 * Client-side navigation filtering hooks.
 *
 * The original starter used Clerk's organization/permission hooks for RBAC-based
 * navigation visibility. This project uses better-auth, which does not expose the
 * same client-side org/permission primitives, so these hooks now act as identity
 * pass-throughs (all nav items are shown).
 *
 * If/when you add role or organization data to the better-auth session, you can
 * reintroduce filtering here. For real security, always enforce access on the
 * server (API routes / server actions) — this is UI visibility only.
 */

import type { NavGroup, NavItem } from "@/types";

/**
 * Returns the navigation items unfiltered.
 */
export function useFilteredNavItems(items: NavItem[]) {
	return items;
}

/**
 * Returns the navigation groups unfiltered (empty groups removed).
 */
export function useFilteredNavGroups(groups: NavGroup[]) {
	return groups.filter((group) => group.items.length > 0);
}
