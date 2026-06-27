import { formatSize } from '../lib/image-processing';

interface FileListProps {
  files: File[];
  onRemove: (index: number) => void;
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
