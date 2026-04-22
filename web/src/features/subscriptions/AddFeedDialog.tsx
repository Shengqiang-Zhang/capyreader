import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { useCategories } from "@/api/queries";
import { useCreateFeed, useDiscoverFeeds } from "./mutations";

interface AddFeedDialogProps {
  open: boolean;
  onClose: () => void;
}

interface DiscoveredFeed {
  title: string;
  url: string;
  type: string;
}

export default function AddFeedDialog({ open, onClose }: AddFeedDialogProps) {
  const categoriesQ = useCategories();
  const discover = useDiscoverFeeds();
  const createFeed = useCreateFeed();

  const [url, setUrl] = useState("");
  const [discovered, setDiscovered] = useState<DiscoveredFeed[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setDiscovered([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (categoryId === null && categoriesQ.data && categoriesQ.data.length > 0) {
      setCategoryId(categoriesQ.data[0]!.id);
    }
  }, [categoriesQ.data, categoryId]);

  async function handleDiscover() {
    setError(null);
    try {
      const results = await discover.mutateAsync(url.trim());
      setDiscovered(results);
      if (results.length === 0) setError("No feeds found at that URL.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed.");
    }
  }

  async function handleSubscribe(feedUrl: string) {
    if (categoryId === null) return;
    setError(null);
    try {
      await createFeed.mutateAsync({ feed_url: feedUrl, category_id: categoryId });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add feed.");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add feed">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="feed-url">Site or feed URL</Label>
          <div className="flex gap-2">
            <Input
              id="feed-url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim()) handleDiscover();
              }}
            />
            <Button
              onClick={handleDiscover}
              disabled={!url.trim() || discover.isPending}
            >
              {discover.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Discover"
              )}
            </Button>
          </div>
        </div>

        {categoriesQ.data && categoriesQ.data.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="category">Add to category</Label>
            <select
              id="category"
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {categoriesQ.data.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {discovered.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Discovered feeds</p>
            <ul className="divide-y rounded-md border">
              {discovered.map((feed) => (
                <li
                  key={feed.url}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{feed.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {feed.url}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSubscribe(feed.url)}
                    disabled={createFeed.isPending || categoryId === null}
                  >
                    Subscribe
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
