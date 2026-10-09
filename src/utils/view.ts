import _ from 'lodash';
import RegExpValidator from 'src/utils/expression';
import type { FormControl } from './controlTypes';

function coverFile(value: unknown): value is { ext?: string | undefined; previewUrl?: unknown } {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (!('ext' in value) || value.ext === undefined || typeof value.ext === 'string')
  );
}

// 获取封面url
export const getCoverUrl = (
  coverId: string | undefined,
  record: Record<string, unknown>,
  controls: FormControl[],
): string | undefined => {
  const coverControl = _.find(controls, c => c.controlId && c.controlId === coverId);

  if (!coverControl) {
    return undefined;
  }

  try {
    if (!coverId) return undefined;
    const files: unknown = safeParse(record[coverId]) || [];
    const entries: unknown[] = Array.isArray(files)
      ? files
      : files !== null && typeof files === 'object'
        ? Object.values(files)
        : [];
    const picture = entries.find(file => coverFile(file) && RegExpValidator.fileIsPicture(file.ext));
    const previewUrl = coverFile(picture) ? picture.previewUrl : undefined;

    if (typeof previewUrl !== 'string' || !previewUrl) {
      return undefined;
    }

    return previewUrl.indexOf('imageView2') > -1
      ? previewUrl.replace(/imageView2\/\d\/w\/\d+\/h\/\d+(\/q\/\d+)?/, 'imageView2/1/w/200/h/140')
      : `${previewUrl}&imageView2/1/w/200/h/140`;
  } catch (err) {
    console.log(err);
  }

  return undefined;
};
