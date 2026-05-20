import { PromptEditorLayout } from "@/components/asset-studio/prompt-editor-layout";

export const metadata = {
  title: "Editor de Prompt | Asset Studio",
};

export default function PromptEditorPage({ params }: { params: { templateId: string } }) {
  return (
    <div className="flex flex-col h-full overflow-hidden p-4 md:p-6">
      <PromptEditorLayout templateId={params.templateId} />
    </div>
  );
}
