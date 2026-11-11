import { useT } from '@/i18n';
import { Button } from '@/ui-kit/components';
import { usePalette } from '@/ui-kit/theme';

import { PhotoSourceSheet } from './photo-source-sheet';
import type { SharePhotoButtonProps } from './share-photo-button.constants';
import { usePhotoPicker } from './use-photo-picker';

/** "Share photo" on the activity screen: the photo choice, then the share screen. */
export function SharePhotoButton({ onPicked }: SharePhotoButtonProps) {
  const p = usePalette();
  const t = useT('share');
  const picker = usePhotoPicker(onPicked);
  return (
    <>
      <Button testID='share-photo' label={t('button')} color={p.card} textColor={p.text} onPress={picker.open} />
      <PhotoSourceSheet picker={picker} />
    </>
  );
}
