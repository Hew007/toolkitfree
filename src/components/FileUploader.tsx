import { useCallback, useRef, useState } from 'react';

interface FileUploaderProps {
  accept?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
}

export default function FileUploader({
  accept = 'image/*',
  multiple = true,
  onFilesSelected,
}: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFilesSelected(files);
    },
    [onFilesSelected]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length > 0) onFilesSelected(files);
      event.target.value = '';
    },
    [onFilesSelected]
  );

  return (
    <div
      className={`tool-area ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-file-drop-zone
    >
      <div className="drop-zone">
        <p
          aria-live="polite"
          style={{ fontSize: '1rem', fontWeight: 500, color: '#1f2937', marginTop: 0 }}
        >
          {isDragOver ? 'Drop files here' : 'Drag and drop files here'}
        </p>
        <p>or</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => inputRef.current?.click()}
        >
          Choose {multiple ? 'images' : 'an image'}
        </button>
        <input
          ref={inputRef}
          style={{ display: 'none' }}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
