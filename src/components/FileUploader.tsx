import { useCallback, useRef, useState } from 'react';
import InputBudgetNotice from './InputBudgetNotice';
import {
  reviewImageBudget,
  type ImageBudgetAssessment,
  type ImageBudgetProfile,
} from '../lib/image-budget';

interface FileUploaderProps {
  accept?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  budgetProfile?: ImageBudgetProfile;
  currentFiles?: readonly File[];
  singleFileLabel?: string;
  compact?: boolean;
}

export default function FileUploader({
  accept = 'image/*',
  multiple = true,
  onFilesSelected,
  budgetProfile,
  currentFiles = [],
  singleFileLabel = 'an image',
  compact = false,
}: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [assessment, setAssessment] = useState<ImageBudgetAssessment | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const reviewIdRef = useRef(0);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const clearReview = useCallback(() => {
    reviewIdRef.current += 1;
    setReviewing(false);
    setAssessment(null);
    setPendingFiles([]);
  }, []);

  const submitFiles = useCallback(
    async (newFiles: File[]) => {
      if (newFiles.length === 0) return;
      if (!budgetProfile) {
        onFilesSelected(newFiles);
        return;
      }

      const reviewId = ++reviewIdRef.current;
      setReviewing(true);
      setAssessment(null);
      setPendingFiles([]);
      try {
        const nextAssessment = await reviewImageBudget(
          [...currentFiles, ...newFiles],
          budgetProfile
        );
        if (reviewId !== reviewIdRef.current) return;
        if (nextAssessment.level === 'safe') {
          onFilesSelected(newFiles);
        } else {
          setPendingFiles(newFiles);
          setAssessment(nextAssessment);
        }
      } catch {
        if (reviewId === reviewIdRef.current) onFilesSelected(newFiles);
      } finally {
        if (reviewId === reviewIdRef.current) setReviewing(false);
      }
    },
    [budgetProfile, currentFiles, onFilesSelected]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      void submitFiles(Array.from(event.dataTransfer.files));
    },
    [submitFiles]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      event.target.value = '';
      void submitFiles(files);
    },
    [submitFiles]
  );

  const handleContinue = () => {
    const files = pendingFiles;
    clearReview();
    if (files.length > 0) onFilesSelected(files);
  };

  return (
    <>
      <div
        className={`tool-area${compact ? ' is-compact' : ''}${isDragOver ? ' drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-file-drop-zone
        aria-busy={reviewing}
      >
        <div className="drop-zone">
          <p className="drop-zone-title" aria-live="polite">
            {reviewing
              ? 'Checking image size and memory needs'
              : isDragOver
                ? 'Drop files here'
                : compact
                  ? 'Add more images'
                  : 'Drag and drop files here'}
          </p>
          {!compact && <p>or</p>}
          <label className={`btn btn-primary file-picker${reviewing ? ' is-disabled' : ''}`}>
            <span>
              {compact ? 'Choose more' : `Choose ${multiple ? 'images' : singleFileLabel}`}
            </span>
            <input
              className="file-picker-input"
              type="file"
              aria-label={multiple ? 'Choose images' : `Choose ${singleFileLabel}`}
              accept={accept}
              multiple={multiple}
              disabled={reviewing}
              onChange={handleChange}
            />
          </label>
        </div>
      </div>

      {reviewing && (
        <div className="visually-hidden" role="status" aria-live="polite">
          Checking image dimensions and estimated memory.
        </div>
      )}
      {assessment && (
        <InputBudgetNotice
          assessment={assessment}
          onCancel={clearReview}
          onContinue={handleContinue}
        />
      )}
    </>
  );
}
