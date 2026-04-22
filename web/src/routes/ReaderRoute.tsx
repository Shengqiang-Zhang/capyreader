import { useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Sidebar from "@/components/Sidebar/Sidebar";
import MiddlePane from "@/components/ArticleList/MiddlePane";
import ArticleView from "@/components/ArticleView/ArticleView";
import ShortcutsDialog from "@/components/ShortcutsDialog";
import { useEntriesForSelection } from "@/hooks/useEntriesQuery";
import { useSelection } from "@/hooks/useSelection";
import { useReaderShortcuts } from "@/keyboard/useReaderShortcuts";

export default function ReaderRoute() {
  const { selection } = useSelection();
  const entriesQ = useEntriesForSelection(selection);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const bindings = useReaderShortcuts({
    entries: entriesQ.data?.entries,
    onShowHelp: () => setHelpOpen(true),
    onFocusSearch: () => searchInputRef.current?.focus(),
  });

  return (
    <>
      <PanelGroup direction="horizontal" className="h-full">
        <Panel
          defaultSize={20}
          minSize={14}
          maxSize={32}
          className="min-w-[180px]"
        >
          <Sidebar className="h-full" searchInputRef={searchInputRef} />
        </Panel>
        <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/40 data-[resize-handle-state=drag]:bg-primary/60" />
        <Panel defaultSize={30} minSize={20} className="min-w-[260px]">
          <MiddlePane />
        </Panel>
        <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/40 data-[resize-handle-state=drag]:bg-primary/60" />
        <Panel defaultSize={50} minSize={30}>
          <ArticleView />
        </Panel>
      </PanelGroup>
      <ShortcutsDialog
        bindings={bindings}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </>
  );
}
