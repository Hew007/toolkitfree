import { useEffect, useState } from 'react';
import { formatSize } from '../lib/image-processing';
import { useI18n } from '../i18n/react';

interface FileListProps {
  files: File[];
  onRemove: (index: number) => void;
}

export default function FileList({ files, onRemove }: FileListProps) {
  const { t } = useI18n();
  if (files.length === 0) return null;

  return (
    <div className="file-list" aria-label={t('Selected files', '已选择的文件')}>
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
            aria-label={t(`Remove ${file.name}`, `移除 ${file.name}`)}
          >
            {t('Remove', '移除')}
          </button>
        </div>
      ))}
    </div>
  );
}

function FileThumbnail({ file }: { file: File }) {
  const { t } = useI18n();
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
      alt={t(`Preview of ${file.name}`, `${file.name} 的预览`)}
      onError={() => setPreviewUrl('')}
    />
  );
}
