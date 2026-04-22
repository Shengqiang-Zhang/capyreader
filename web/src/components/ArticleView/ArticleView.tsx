import { ExternalLink, Star } from "lucide-react";
import { useEntry } from "@/api/queries";
import { useSelection } from "@/hooks/useSelection";
import { buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { fullDateTime } from "@/lib/time";

export default function ArticleView() {
  const { selection } = useSelection();
  const entryId = selection.entryId;
  const entryQ = useEntry(entryId ?? 0, entryId !== null);

  if (entryId === null) {
    return (
      <section className="flex h-full items-center justify-center bg-muted/20 p-8 text-center">
        <div className="max-w-sm text-muted-foreground">
          <p className="font-display text-2xl text-foreground">
            Pick an article.
          </p>
          <p className="mt-2 text-sm">
            Articles from the selected feed show up here. Keyboard navigation
            and rich rendering arrive in later phases.
          </p>
        </div>
      </section>
    );
  }

  if (entryQ.isLoading) {
    return (
      <section className="h-full overflow-y-auto p-10">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <div className="mt-8 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </section>
    );
  }

  if (entryQ.isError || !entryQ.data) {
    return (
      <section className="flex h-full items-center justify-center p-8 text-sm text-destructive">
        Could not load this article.
      </section>
    );
  }

  const entry = entryQ.data;

  return (
    <section className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-4 border-b px-10 py-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {entry.feed.title}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold leading-tight">
            {entry.title}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {entry.author ? `${entry.author} · ` : ""}
            {fullDateTime(entry.published_at)}
            {entry.reading_time > 0 && ` · ${entry.reading_time} min read`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {entry.starred && (
            <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
          )}
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </a>
        </div>
      </header>
      <article className="flex-1 overflow-y-auto px-10 py-8">
        <div
          className="prose prose-slate max-w-3xl font-serif prose-headings:font-display prose-a:text-primary dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: entry.content }}
        />
      </article>
    </section>
  );
}
