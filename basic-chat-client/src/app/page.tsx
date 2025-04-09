import { Chat } from "@/components/chat"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-6">AI Chat with MCP Tools</h1>
      <Chat />
    </main>
  )
}
