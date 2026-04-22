import { LogOut } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useMe } from "@/api/queries";
import { Button } from "@/components/ui/Button";

export default function ReaderRoute() {
  const { signOut } = useAuth();
  const me = useMe();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="font-display text-lg font-semibold">Capy Reader</div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {me.isLoading
              ? "Loading…"
              : me.isError
                ? "Not connected"
                : `Hello, ${me.data?.username}`}
          </span>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="font-display text-2xl">Reader shell goes here.</p>
          <p className="mt-2 text-sm">Phase 2 wires up the three-pane view.</p>
        </div>
      </main>
    </div>
  );
}
