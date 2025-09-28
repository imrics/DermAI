import { useUserContext } from '@/contexts/UserContext';

export function useSequenceId() {
  const { getSequenceId, setSequenceId } = useUserContext();
  
  return {
    getSequenceId,
    setSequenceId,
  };
}
