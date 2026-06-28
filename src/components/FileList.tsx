import { formatSize } from '../lib/image-processing';

interface FileListProps {
  files: File[];
  onRemove: (index: number) => void;
}

export default function FileList({ files, onRemove }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="file-list" aria-label="Selected files">
      {files.map((file, index) => (
        <div key={`${file.name}-${index}`} className="file-item">
          <span className="file-item-name">{file.name}</span>
          <span className="file-item-size">{formatSize(file.size)}</span>
          <button
            type="button"
            className="file-item-remove"
            onClick={() => onRemove(index)}
            aria-label={`Remove ${file.name}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
