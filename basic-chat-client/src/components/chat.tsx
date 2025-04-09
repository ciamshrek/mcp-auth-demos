"use client"

import { useChat } from "@ai-sdk/react"
import { useRef, useEffect } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { MCPInstaller } from "./mcp-installer"
import { ToolInvocationUIPart } from "@ai-sdk/ui-utils"

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: "/api/chat",
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  return (
    <div className="flex flex-col h-[600px] w-full max-w-3xl mx-auto border rounded-lg">
      <ScrollArea className="flex-1 p-4 h-[600px]">
        <div className="space-y-4">
          {messages.map((message) => {
            // Check if this message has parts and contains a tool call
            const hasMCPToolCall = message.parts?.some(
              (part) => part.type === "tool-invocation" && part.toolInvocation.toolName === "mcp_server_installer",
            )

            if (message.role === "assistant" && hasMCPToolCall) {
              // Find the tool call part to get the tool output
              const toolCallPart: ToolInvocationUIPart = message.parts.find(
                (part) => part.type === "tool-invocation" && part.toolInvocation.toolName === "mcp_server_installer"
              ) as unknown as ToolInvocationUIPart;

              // Get the tool response part if it exists
              const toolResponsePart: ToolInvocationUIPart = message.parts.find(
                (part) => part.type === "tool-invocation" && part.toolInvocation.state === "result" && part.toolInvocation.toolCallId === toolCallPart.toolInvocation.toolCallId,
              )   as unknown as ToolInvocationUIPart;

              // Get the servers from the tool response if available
              const servers = toolResponsePart?.toolInvocation?.state === "result" && toolResponsePart.toolInvocation.result || [];

              return (
                <div key={message.id} className="flex justify-start mb-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="/assistant-avatar.png" alt="AI" />
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">I found some MCP servers you can install:</p>
                      <MCPInstaller servers={servers} />
                    </div>
                  </div>
                </div>
              )
            }

            // Regular message - get text content from parts or fallback to content
            const textContent = message.parts?.find((part) => part.type === "text")?.text || message.content

            return (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} mb-4`}
              >
                {message.role === "assistant" && (
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarImage src="/assistant-avatar.png" alt="AI" />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                )}

                <Card className={message.role === "user" ? "bg-primary text-primary-foreground" : ""}>
                  <CardContent className="px-3">{textContent}</CardContent>
                </Card>

                {message.role === "user" && (
                  <Avatar className="h-8 w-8 ml-2">
                    <AvatarImage src="/user-avatar.png" alt="User" />
                    <AvatarFallback>You</AvatarFallback>
                  </Avatar>
                )}
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
