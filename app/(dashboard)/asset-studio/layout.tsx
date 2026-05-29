import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

export default function AssetStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6">
        <h1 className="text-lg font-semibold">Asset Studio</h1>
        <Tabs defaultValue="prompts" className="ml-auto">
          <TabsList>
            <Link href="/asset-studio/prompts">
              <TabsTrigger value="prompts">Prompts</TabsTrigger>
            </Link>
            <Link href="/asset-studio/documents">
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </Link>
            <Link href="/asset-studio/variables">
              <TabsTrigger value="variables">Variables</TabsTrigger>
            </Link>
          </TabsList>
        </Tabs>
      </header>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
