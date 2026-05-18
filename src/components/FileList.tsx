interface FileListProps {
  files: File[];
  onRemove: (index: number) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function FileList({ files, onRemove }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="file-list">
      {files.map((file, index) => (
        <div key={`${file.name}-${index}`} className="file-item">
          <span className="file-item-name">{file.name}</span>
          <span className="file-item-size">{formatSize(file.size)}</span>
          <button
            className="file-item-remove"
            onClick={() => onRemove(index)}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
