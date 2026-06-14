import { NextResponse } from "next/server";
import { getSession } from "@/server/better-auth/server";
import { getPresignedUrl } from "@/server/storage/minio";

export async function GET(request: Request) {
	const session = await getSession();
	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const key = searchParams.get("key");
	if (!key) {
		return NextResponse.json({ error: "Missing key" }, { status: 400 });
	}

	const url = await getPresignedUrl(key, 3600);
	return NextResponse.json({ url });
}
