import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attachmentsApi, AttachmentType, Attachment } from "@/api/attachments";
import { 
  FileIcon, 
  ImageIcon, 
  FileTextIcon, 
  Download, 
  Trash2, 
  Plus,
  Loader2,
  FileArchive,
} from "lucide-react";

interface AttachmentListProps {
  entityType: AttachmentType;
  entityId: number;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon size={18} />;
  if (mimeType === "application/pdf") return <FileTextIcon size={18} />;
  if (mimeType.includes("zip") || mimeType.includes("archive")) return <FileArchive size={18} />;
  return <FileIcon size={18} />;
}

export function AttachmentList({ entityType, entityId }: AttachmentListProps) {
  const queryClient = useQueryClient();
  const queryKey = ["attachments", entityType, entityId];

  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => attachmentsApi.list(entityType, entityId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(entityType, entityId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => attachmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = ""; // Reset
    }
  };

  if (isLoading) return <div className="text-xs text-gray-400">Loading files...</div>;

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {attachments.map((attachment) => {
            const isImage = attachment.mimeType.startsWith("image/");
            const publicUrl = attachmentsApi.getPublicUrl(attachment.storedPath);
            const downloadUrl = attachmentsApi.getDownloadUrl(attachment.id);

            return (
              <div 
                key={attachment.id}
                className="group flex items-center gap-3 p-2 rounded-lg border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all"
              >
                {/* Preview / Icon */}
                <div className="w-10 h-10 rounded bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-100">
                  {isImage ? (
                    <img src={publicUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400">{getFileIcon(attachment.mimeType)}</span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate" title={attachment.filename}>
                    {attachment.filename}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase">
                    {new Date(attachment.createdAt).toLocaleDateString()} • {attachment.uploader?.name}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50"
                    title="Download"
                  >
                    <Download size={14} />
                  </a>
                  <button
                    onClick={() => {
                      if (confirm("Delete this file?")) deleteMutation.mutate(attachment.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload button */}
      <label className="relative flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-all group">
        {uploadMutation.isPending ? (
          <Loader2 size={16} className="animate-spin text-indigo-500" />
        ) : (
          <Plus size={16} className="group-hover:scale-110 transition-transform" />
        )}
        <span className="text-xs font-medium">
          {uploadMutation.isPending ? "Uploading..." : "Add a file"}
        </span>
        <input 
          type="file" 
          className="hidden" 
          onChange={handleFileChange} 
          disabled={uploadMutation.isPending} 
        />
      </label>
    </div>
  );
}
