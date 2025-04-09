"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, Server } from "lucide-react";

interface MCPServer {
  name: string;
  address: string;
}

interface DiscoveryMessage {
  message: string;
  [key: string]: string | string[];
}

interface ClientInfo {
  clientId: string;
  clientSecret: string;
  protocol: "oidc" | "oauth2";
  scopesSupported: string[];
  name: string;
  authorizationServer: string;
  resource: string;
}

export function MCPInstaller({ servers }: { servers: MCPServer[] }) {
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [discoveryState, setDiscoveryState] = useState<
    "idle" | "discovering" | "discovered" | "error"
  >("idle");
  const [discoveryMessages, setDiscoveryMessages] = useState<string[]>([]);
  const [discoveredInfo, setDiscoveredInfo] = useState<ClientInfo | null>(null);
  const [installState, setInstallState] = useState<
    "idle" | "installing" | "installed" | "error"
  >("idle");

  const startDiscovery = async (server: MCPServer) => {
    setSelectedServer(server);
    setDiscoveryState("discovering");
    setDiscoveryMessages([]);

    try {
      const response = await fetch(
        `/auth/discover`, {
            body: JSON.stringify(server),
            method: "POST"
        }
      );

      console.log(response);
      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        console.log("Reading");
        const { done, value } = await reader.read();

        console.log("Decoding");

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
            try {
                console.log(line);
                const data = JSON.parse(line) as DiscoveryMessage;
                console.log(data);
                setDiscoveryMessages((prev) => [...prev, data.message]);
    
                // Check if this is the final message with all the client info
                if (data.clientId && data.protocol) {
                  setDiscoveredInfo(data as unknown as ClientInfo);
                  setDiscoveryState("discovered");
                }    
            } catch {}
        }

        console.log("appending lines");

        if (done) break;

      }

      console.log("Done");

    } catch (error) {
      console.error("Discovery error:", error);
      setDiscoveryState("error");
      setDiscoveryMessages((prev) => [
        ...prev,
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      ]);
    }
  };

  const saveClientInfo = async () => {
    if (!discoveredInfo) return;

    setInstallState("installing");

    try {
      const response = await fetch("/auth/install", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discoveredInfo),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setInstallState("installed");
    } catch (error) {
      console.error("Installation error:", error);
      setInstallState("error");
    }
  };

  const renderServerList = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Available MCP Servers</h3>
      {servers.map((server) => (
        <Card
          key={server.address}
          className="hover:bg-muted/50 transition-colors"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              {server.name}
            </CardTitle>
            <CardDescription className="text-xs truncate">
              {server.address}
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2">
            <Button
              size="sm"
              onClick={() => startDiscovery(server)}
              disabled={discoveryState === "discovering"}
            >
              Install
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );

  const renderDiscoveryProcess = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          Installing {selectedServer?.name}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDiscoveryState("idle");
            setSelectedServer(null);
          }}
          disabled={discoveryState === "discovering"}
        >
          Back
        </Button>
      </div>

      <div className="border rounded-md p-4 bg-muted/20 space-y-2 max-h-60 overflow-y-auto font-mono text-sm">
        {discoveryMessages.map((message, index) => (
          <div key={index} className="whitespace-pre-wrap">
            {message}
          </div>
        ))}

        {discoveryState === "discovering" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Discovering...
          </div>
        )}
      </div>

      {discoveryState === "discovered" && discoveredInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration Details</CardTitle>
            <CardDescription>Review and save these details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Name:</span> {discoveredInfo.name}
            </div>
            <div>
              <span className="font-medium">Protocol:</span>{" "}
              {discoveredInfo.protocol.toUpperCase()}
            </div>
            <div>
              <span className="font-medium">Client ID:</span>{" "}
              {discoveredInfo.clientId}
            </div>
            <div>
              <span className="font-medium">Scopes:</span>{" "}
              {discoveredInfo.scopesSupported.join(", ")}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={saveClientInfo}
              disabled={
                installState === "installing" || installState === "installed"
              }
            >
              {installState === "installing" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : installState === "installed" ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Saved
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {installState === "installed" && (
        <Alert variant="default" className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-600">
            MCP Server installed successfully! You can now use the additional
            tools it provides.
            <Button asChild><a target="_blank" href={`/auth/start?resource=${discoveredInfo!.resource}`}>Authorize</a></Button>
          </AlertDescription>
        </Alert>
      )}

      {installState === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to save configuration. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {discoveryState === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Discovery process failed. Please check the server address and try
            again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto">
      {discoveryState === "idle"
        ? renderServerList()
        : renderDiscoveryProcess()}
    </div>
  );
}
