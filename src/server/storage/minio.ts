import * as Minio from "minio";
import { env } from "@/env";

const endpoint = env.MINIO_ENDPOINT ?? "localhost";
const port = env.MINIO_PORT ?? 9000;
const useSSL = env.MINIO_USE_SSL === "true";
const bucket = env.MINIO_BUCKET ?? "efms";

const globalForMinio = globalThis as unknown as {
	minioClient: Minio.Client | undefined;
};

export const minioClient =
	globalForMinio.minioClient ??
	new Minio.Client({
		endPoint: endpoint,
		port,
		useSSL,
		accessKey: env.MINIO_ACCESS_KEY ?? "minioadmin",
		secretKey: env.MINIO_SECRET_KEY ?? "minioadmin",
	});

if (process.env.NODE_ENV !== "production") {
	globalForMinio.minioClient = minioClient;
}

async function ensureBucket() {
	try {
		const exists = await minioClient.bucketExists(bucket);
		if (!exists) {
			await minioClient.makeBucket(bucket, "us-east-1");
		}
	} catch {
		// MinIO not reachable in build/test — silently skip
	}
}

export async function uploadBuffer(
	key: string,
	buffer: Buffer,
	contentType: string,
): Promise<string> {
	await ensureBucket();
	await minioClient.putObject(bucket, key, buffer, buffer.length, {
		"Content-Type": contentType,
	});
	return key;
}

export async function getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
	return minioClient.presignedGetObject(bucket, key, expirySeconds);
}

export async function deleteObject(key: string): Promise<void> {
	try {
		await minioClient.removeObject(bucket, key);
	} catch {
		// ignore if not found
	}
}

export { bucket as MINIO_BUCKET };
