import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient, Role } from "../generated/prisma/index.js";

loadEnv();

const demoUser = {
	email: "demo@easylearning.in",
	name: "EasyLearning Demo Admin",
	password: "Demo@12345",
};

const db = new PrismaClient();
const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
	database: prismaAdapter(db, {
		provider: "postgresql",
	}),
	emailAndPassword: {
		enabled: true,
	},
	secret: process.env.BETTER_AUTH_SECRET ?? "development-demo-secret",
});

await db.user.deleteMany({
	where: { email: demoUser.email },
});

await auth.api.signUpEmail({
	body: demoUser,
});

const user = await db.user.findUniqueOrThrow({
	where: { email: demoUser.email },
});

const organization = await db.organization.create({
	data: {
		name: "EasyLearning",
		slug: `easylearning-demo-${user.id.slice(0, 8).toLowerCase()}`,
	},
});

await db.user.update({
	where: { id: user.id },
	data: {
		organizationId: organization.id,
		role: Role.ORG_OWNER,
	},
});

await db.$disconnect();

console.log("Demo user ready:");
console.log(`Email: ${demoUser.email}`);
console.log(`Password: ${demoUser.password}`);

function loadEnv() {
	const envPath = resolve(process.cwd(), ".env");

	try {
		const envFile = readFileSync(envPath, "utf8");

		for (const line of envFile.split("\n")) {
			const trimmed = line.trim();

			if (!trimmed || trimmed.startsWith("#")) {
				continue;
			}

			const separatorIndex = trimmed.indexOf("=");

			if (separatorIndex === -1) {
				continue;
			}

			const key = trimmed.slice(0, separatorIndex);
			const value = trimmed
				.slice(separatorIndex + 1)
				.replace(/^["']|["']$/g, "");

			process.env[key] ??= value;
		}
	} catch {
		// The script can still run when env vars are already provided by the shell.
	}
}
