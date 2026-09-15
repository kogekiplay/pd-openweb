import { find, identity } from 'lodash';
import type { FormControl } from 'src/utils/controlTypes';

// 业务规则
function overrideControls(control, controls) {
  return controls.map((c: FormControl) => {
    const resetControl = find(control.relationControls, { controlId: c.controlId });

    if (resetControl) {
      c.required = resetControl.required;
      c.fieldPermission = resetControl.fieldPermission;
    }

    return c;
  });
}

export function getVisibleControls(control, controls, sheetHiddenColumnIds = [], disableMaskDataControls = {}) {
  const overriddenControls = overrideControls(control, controls)
    .filter(c => !find(sheetHiddenColumnIds, id => c.controlId === id))
    .map(c =>
      disableMaskDataControls[c.controlId]
        ? {
            ...c,
            advancedSetting: Object.assign({}, c.advancedSetting, {
              datamask: '0',
            }),
          }
        : c,
    );
  return control.showControls.map((sid: FormControl) => find(overriddenControls, { controlId: sid })).filter(identity);
}
