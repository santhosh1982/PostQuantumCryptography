import { Settings, Sun, Moon, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "./ThemeProvider";
import { Badge } from "@/components/ui/badge";

export function SettingsModal() {
  const { theme, setTheme } = useTheme();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-settings">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" data-testid="modal-settings">
        <DialogHeader>
          <DialogTitle className="text-2xl">Settings</DialogTitle>
          <DialogDescription>
            Configure your PQC chat security and appearance preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="security" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
            <TabsTrigger value="appearance" data-testid="tab-appearance">Appearance</TabsTrigger>
            <TabsTrigger value="advanced" data-testid="tab-advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="security" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium mb-1">Post-Quantum Algorithms</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Current encryption uses ML-KEM-768 for key encapsulation and ML-DSA-65 for digital signatures
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                      ML-KEM-768
                    </Badge>
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                      ML-DSA-65
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>Auto Key Rotation</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically rotate encryption keys every 24 hours
                  </p>
                </div>
                <Switch defaultChecked data-testid="switch-auto-rotation" />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>Perfect Forward Secrecy</Label>
                  <p className="text-sm text-muted-foreground">
                    Generate new session keys for each conversation
                  </p>
                </div>
                <Switch defaultChecked data-testid="switch-forward-secrecy" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-3 block">Theme</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={theme === "light" ? "default" : "outline"}
                    onClick={() => setTheme("light")}
                    className="gap-2"
                    data-testid="button-theme-light"
                  >
                    <Sun className="h-4 w-4" />
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "outline"}
                    onClick={() => setTheme("dark")}
                    className="gap-2"
                    data-testid="button-theme-dark"
                  >
                    <Moon className="h-4 w-4" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === "system" ? "default" : "outline"}
                    onClick={() => setTheme("system")}
                    className="gap-2"
                    data-testid="button-theme-system"
                  >
                    <Zap className="h-4 w-4" />
                    System
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>Show Encryption Indicators</Label>
                  <p className="text-sm text-muted-foreground">
                    Display PQC badges on encrypted messages
                  </p>
                </div>
                <Switch defaultChecked data-testid="switch-encryption-indicators" />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>Compact Message View</Label>
                  <p className="text-sm text-muted-foreground">
                    Reduce spacing between messages
                  </p>
                </div>
                <Switch data-testid="switch-compact-view" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <h3 className="font-medium mb-2 text-warning">Advanced Settings</h3>
                <p className="text-sm text-muted-foreground">
                  These settings affect core cryptographic operations. Only modify if you understand the implications.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>WebSocket Auto-Reconnect</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically reconnect on connection loss
                  </p>
                </div>
                <Switch defaultChecked data-testid="switch-auto-reconnect" />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>Enable Message Signatures</Label>
                  <p className="text-sm text-muted-foreground">
                    Sign all messages with ML-DSA-65 (increases latency)
                  </p>
                </div>
                <Switch data-testid="switch-message-signatures" />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label>Debug Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Show technical details and connection logs
                  </p>
                </div>
                <Switch data-testid="switch-debug-mode" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
