import { DirectorView } from "@/components/DirectorView";

export default async function DirectorPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  return <DirectorView roomCode={roomCode.toUpperCase()} />;
}
