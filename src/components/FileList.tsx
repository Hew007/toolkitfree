import { useEffect, useState } from 'react';
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
          <FileThumbnail file={file} />
          <span className="file-item-details">
            <span className="file-item-name">{file.name}</span>
            <span className="file-item-size">{formatSize(file.size)}</span>
          </span>
          <button
            type="button"
            className="file-item-remove"
            onClick={() => onRemove(index)}
            aria-label={`Remove ${file.name}`}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function FileThumbnail({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file.type.startsWith('image/')) {
      setPreviewUrl('');
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  if (!previewUrl) return null;

  return (
    <img
      className="file-item-thumbnail"
      src={previewUrl}
      alt={`Preview of ${file.name}`}
      onError={() => setPreviewUrl('')}
    />
  );
}
