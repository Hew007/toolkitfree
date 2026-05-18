interface DownloadResultProps {
  name: string;
  size: number;
  url: string;
  previewUrl?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function DownloadResult({ name, size, url, previewUrl }: DownloadResultProps) {
  return (
    <div className="result-item">
      <div className="result-info">
        {previewUrl && (
          <img src={previewUrl} alt={name} className="result-preview" />
        )}
        <div>
          <div className="file-item-name">{name}</div>
          <div className="file-item-size">{formatSize(size)}</div>
        </div>
      </div>
      <a href={url} download={name} className="btn btn-primary">
        Download
      </a>
    </div>
  );
}
