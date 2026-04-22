import { useState, type FormEvent } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { minifluxApi, MinifluxError } from "@/api/miniflux";
import { normalizeBaseUrl } from "@/auth/token-store";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

const DEFAULT_URL = import.meta.env.VITE_DEFAULT_MINIFLUX_URL ?? "";

export default function LoginRoute() {
  const { signIn } = useAuth();
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("verifying");
    setError(null);
    const candidate = { baseUrl: normalizeBaseUrl(baseUrl), token: token.trim() };
    try {
      await minifluxApi.me(candidate);
      signIn(candidate);
    } catch (err) {
      setStatus("error");
      if (err instanceof MinifluxError) {
        setError(err.status === 401 ? "Invalid API token." : err.message);
      } else if (err instanceof TypeError) {
        setError(
          "Could not reach that URL. Check for typos, HTTPS, and CORS on your Miniflux instance.",
        );
      } else {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-background to-muted p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Connect to Miniflux
          </CardTitle>
          <CardDescription>
            Your feeds live on your Miniflux server. Enter its URL and an API
            token from Settings → API Keys.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Server URL</Label>
              <Input
                id="baseUrl"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://miniflux.example.com"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="token">API token</Label>
              <Input
                id="token"
                type="password"
                autoComplete="current-password"
                placeholder="miniflux_api_token_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={status === "verifying"}
            >
              {status === "verifying" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
