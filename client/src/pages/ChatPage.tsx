import { useState, useEffect, useRef } from "react";
import { Shield, Wifi, WifiOff, User } from "lucide-react";
import { ChatMessage } from "@/components/ChatMessage";
import { MessageInput } from "@/components/MessageInput";
import { KeyExchangePanel } from "@/components/KeyExchangePanel";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { SettingsModal } from "@/components/SettingsModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { pqcrypto } from "@/lib/pqc";
import type { Message, WSMessage } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [peerId, setPeerId] = useState<string>("");
  const [localPublicKey, setLocalPublicKey] = useState<string>("");
  const [peerPublicKey, setPeerPublicKey] = useState<string>("");
  const [keyStatus, setKeyStatus] = useState<"idle" | "generating" | "exchanging" | "verified">("idle");
  const [encryptionReady, setEncryptionReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setConnected(true);
      toast({
        title: "Connected",
        description: "WebSocket connection established",
      });
    };

    socket.onmessage = async (event) => {
      const data: WSMessage = JSON.parse(event.data);

      if (data.type === "connection") {
        setPeerId(data.payload.peerId);
      } else if (data.type === "key-exchange") {
        setPeerPublicKey(data.payload.publicKey);
        setKeyStatus("exchanging");
        
        try {
          if (data.payload.ciphertext) {
            await pqcrypto.decapsulate(data.payload.ciphertext);
            setEncryptionReady(true);
            setKeyStatus("verified");
            toast({
              title: "Key exchange complete",
              description: "End-to-end encryption is now active",
            });
          } else {
            const { ciphertext } = await pqcrypto.encapsulate(data.payload.publicKey);
            
            if (socket.readyState === WebSocket.OPEN) {
              const responseMsg: WSMessage = {
                type: "key-exchange",
                payload: {
                  publicKey: localPublicKey,
                  algorithm: "ml-kem-768",
                  ciphertext,
                },
              };
              socket.send(JSON.stringify(responseMsg));
            }
            
            setEncryptionReady(true);
            setKeyStatus("verified");
            toast({
              title: "Key exchange complete",
              description: "End-to-end encryption is now active",
            });
          }
        } catch (error) {
          console.error("Key exchange failed:", error);
          toast({
            title: "Key exchange failed",
            description: "Could not establish secure connection",
            variant: "destructive",
          });
        }
      } else if (data.type === "chat") {
        const message = data.payload;
        
        if (message.encrypted) {
          try {
            const decryptedContent = await pqcrypto.decrypt(message.content);
            setMessages(prev => [...prev, { ...message, content: decryptedContent }]);
          } catch (error) {
            console.error("Decryption failed:", error);
            setMessages(prev => [...prev, { ...message, content: "[Decryption failed]" }]);
          }
        } else {
          setMessages(prev => [...prev, message]);
        }
      }
    };

    socket.onclose = () => {
      setConnected(false);
      toast({
        title: "Disconnected",
        description: "WebSocket connection closed",
        variant: "destructive",
      });
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast({
        title: "Connection error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [localPublicKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleGenerateKeys = async () => {
    setKeyStatus("generating");
    try {
      const keyPair = await pqcrypto.generateKEMKeyPair();
      await pqcrypto.generateDSAKeyPair();
      setLocalPublicKey(keyPair.publicKey);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        const keyExchangeMsg: WSMessage = {
          type: "key-exchange",
          payload: {
            publicKey: keyPair.publicKey,
            algorithm: "ml-kem-768",
          },
        };
        ws.send(JSON.stringify(keyExchangeMsg));
      }
      
      toast({
        title: "Keys generated",
        description: "PQC key pair created successfully",
      });
    } catch (error) {
      console.error("Key generation failed:", error);
      toast({
        title: "Key generation failed",
        description: "Could not generate PQC keys",
        variant: "destructive",
      });
      setKeyStatus("idle");
    }
  };

  const handleSendMessage = async (content: string, image?: File) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast({
        title: "Not connected",
        description: "Please wait for connection to establish",
        variant: "destructive",
      });
      return;
    }

    let imageUrl = "";
    if (image) {
      const reader = new FileReader();
      imageUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(image);
      });
    }

    let messageContent = content;
    let encrypted = false;

    if (encryptionReady && content) {
      try {
        messageContent = await pqcrypto.encrypt(content);
        encrypted = true;
      } catch (error) {
        console.error("Encryption failed:", error);
        toast({
          title: "Encryption failed",
          description: "Sending unencrypted message",
          variant: "destructive",
        });
      }
    }

    const message: Message = {
      id: crypto.randomUUID(),
      senderId: peerId,
      receiverId: "peer",
      content: messageContent,
      type: image ? "image" : "text",
      encrypted,
      timestamp: Date.now(),
      imageUrl,
    };

    const wsMessage: WSMessage = {
      type: "chat",
      payload: message,
    };

    ws.send(JSON.stringify(wsMessage));
    
    const displayMessage = {
      ...message,
      content: content,
    };
    setMessages(prev => [...prev, displayMessage]);
  };

  const keyFingerprint = localPublicKey ? pqcrypto.getKeyFingerprint(localPublicKey) : undefined;

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b bg-background/95 backdrop-blur-lg">
        <div className="flex items-center justify-between h-full px-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            {connected ? (
              <Wifi className="h-5 w-5 text-success" data-testid="icon-connected" />
            ) : (
              <WifiOff className="h-5 w-5 text-destructive" data-testid="icon-disconnected" />
            )}
            <ConnectionStatus status={connected ? (keyStatus === "verified" ? "online" : "key-exchange") : "offline"} />
          </div>

          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Peer Chat</span>
            {encryptionReady && (
              <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/20" data-testid="badge-pqc-encrypted">
                <Shield className="h-3 w-3" />
                PQC Encrypted
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SettingsModal />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden pt-16">
        <div className="flex h-full max-w-7xl mx-auto gap-6 p-6">
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto pb-24 space-y-2" data-testid="messages-container">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <div className="space-y-3">
                    <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
                    <h3 className="text-lg font-medium text-muted-foreground">No messages yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {encryptionReady 
                        ? "Start sending encrypted messages with post-quantum cryptography" 
                        : "Generate keys to enable end-to-end encryption"}
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isOwn={msg.senderId === peerId}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <MessageInput
              onSendMessage={handleSendMessage}
              disabled={!connected}
            />
          </div>

          <div className="w-96 shrink-0">
            <KeyExchangePanel
              localPublicKey={localPublicKey}
              peerPublicKey={peerPublicKey}
              onGenerateKeys={handleGenerateKeys}
              onSharePublicKey={(key) => console.log("Share key:", key)}
              keyFingerprint={keyFingerprint}
              status={keyStatus}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
