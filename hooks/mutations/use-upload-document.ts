import { useMutation, useQueryClient } from "@tanstack/react-query";

async function uploadDocuments(files: File | File[]) {
  const formData = new FormData();
  const fileArray = Array.isArray(files) ? files : [files];
  
  fileArray.forEach(file => {
    formData.append("file", file);
  });

  const res = await fetch("/api/asset-studio/documents/upload", {
    method: "POST",
    body: formData,
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to upload document");
  }
  return res.json();
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDocuments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset-studio", "documents"] });
    },
  });
}
