import { useEffect, useRef } from 'react';
import { ObjectUrlRegistry } from '../lib/image-processing';

export function useObjectUrlRegistry(): ObjectUrlRegistry {
  const registryRef = useRef<ObjectUrlRegistry | null>(null);
  if (!registryRef.current) registryRef.current = new ObjectUrlRegistry();

  useEffect(() => {
    const registry = registryRef.current;
    return () => registry?.revokeAll();
  }, []);

  return registryRef.current;
}
