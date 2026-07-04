import { GameRoom } from "@/components/GameRoom";

export default async function GamePage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  return <GameRoom roomCode={roomCode.toUpperCase()} />;
}
