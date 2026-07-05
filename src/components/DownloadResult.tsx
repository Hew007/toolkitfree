import { formatSize } from '../lib/image-processing';

interface DownloadResultProps {
  name: string;
  size: number;
  url: string;
  previewUrl?: string;
}

export default function DownloadResult({ name, size, url, previewUrl }: DownloadResultProps) {
  return (
    <div className="result-item">
      <div className="result-info">
        {previewUrl && <img src={previewUrl} alt={name} className="result-preview" />}
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
