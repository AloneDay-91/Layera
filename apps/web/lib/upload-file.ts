export type PresignResponse = {
  uploadId: string;
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(file);
  });
}

export async function uploadFileDirect(
  file: File,
  folderId: string | null,
  onProgress: (percent: number) => void,
) {
  const presignRes = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      folderId,
    }),
  });
  if (!presignRes.ok) {
    throw new Error("Failed to presign upload");
  }
  const presign = (await presignRes.json()) as PresignResponse;

  await putWithProgress(presign.url, file, presign.headers, onProgress);

  const completeRes = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId: presign.uploadId }),
  });
  if (!completeRes.ok) {
    throw new Error("Failed to complete upload");
  }
}
