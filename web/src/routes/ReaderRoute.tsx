import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Sidebar from "@/components/Sidebar/Sidebar";
import MiddlePane from "@/components/ArticleList/MiddlePane";
import ArticleView from "@/components/ArticleView/ArticleView";

export default function ReaderRoute() {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel
        defaultSize={20}
        minSize={14}
        maxSize={32}
        className="min-w-[180px]"
      >
        <Sidebar className="h-full" />
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
  );
}
